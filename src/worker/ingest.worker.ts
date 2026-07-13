/// <reference lib="webworker" />
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectSchema } from '@/ingest/schema-detect'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import { buildIndex, buildMaestro, resolveSegmento, type SegmentoContext, type SegmentoResult } from '@/pipeline/segmento'
import { buildEstadoContext, resolveEstado } from '@/pipeline/estado'
import { MetricsAccumulator, scdcCrudoPct } from '@/pipeline/metrics'
import { createColaAccumulator, stableId } from '@/pipeline/cola'
import { MaestroBuilder, parseFechaOrden } from '@/pipeline/maestro'
import { applyMaestroRecovery, type UnresueltoTally } from '@/pipeline/recovery'
import { processRow, outputColumns, type ResolvedRow } from '@/pipeline/process-row'
import { csvLine } from '@/reports/csv'
import type { ProgressEvent, IngestSummary, FileKind, MethodTally, PipelineRunResult } from '@/contracts/pipeline'
import type { DistribuidorRow } from '@/contracts/dist'
import type { ColaItem } from '@/contracts/cola'
import type { MaestroEntry } from '@/contracts/maestro'
import { OUTPUT_COLUMNS, type FlagRegistro, type SchemaMap } from '@/contracts/row'

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

// A schema is usable if at least one core field (RIF / segment / state) was mapped.
const schemaIsUsable = (s: SchemaMap) => s.rif !== null || s.segmentoCrudo !== null || s.estadoCrudo !== null

self.onmessage = async (
  ev: MessageEvent<{
    file: File
    mode?: 'pipeline' | 'export'
    maestro?: MaestroEntry[]
    versionDiccionario?: string
    runId?: string
  }>,
) => {
  const { file, mode } = ev.data
  if (mode === 'pipeline') return runPipeline(file)
  if (mode === 'export') {
    return runExport(file, ev.data.maestro ?? [], ev.data.versionDiccionario ?? '', ev.data.runId ?? '')
  }
  return runCounting(file)
}

// ── Counting path (unchanged) — feeds startIngest/Corrida's live row/distributor tally. ──
async function runCounting(file: File) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  let schema: SchemaMap | null = null
  let badSchema = false
  let rows = 0
  const owners = new Set<string>()
  const started = performance.now()
  // Incremental for CSV via PapaParse's cursor; XLSX is fully buffered (no cursor) so it stays at file.size.
  let bytesRead = file.size
  const bump = () => post({ type: 'progress', rows, distributors: owners.size, bytesRead })

  const onHeaders = (headers: string[]) => { schema = detectSchema(headers) }
  const onRow = (rec: Record<string, string>) => {
    rows++
    if (schema?.rif) { const v = normalizeText(rec[schema.rif] ?? ''); if (v) owners.add(v) }
    if (rows % 5000 === 0) bump()
  }

  try {
    if (kind === 'csv') {
      bytesRead = 0
      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true, skipEmptyLines: true, worker: false,
          step: (res, parser) => {
            if (!schema) {
              // Prefer PapaParse's authoritative field list; fall back to first row's keys.
              onHeaders(res.meta.fields ?? Object.keys(res.data))
              if (schema && !schemaIsUsable(schema)) { badSchema = true; parser.abort(); return }
            }
            if (typeof res.meta.cursor === 'number') bytesRead = res.meta.cursor
            onRow(res.data)
          },
          complete: () => resolve(),
          error: (err) => reject(err),
        })
      })
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      if (json.length) {
        onHeaders(Object.keys(json[0]))
        if (schema && !schemaIsUsable(schema)) badSchema = true
      }
      if (!badSchema) for (const rec of json) onRow(rec)
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (badSchema) return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' })
  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' })
  const finished = performance.now()
  const summary: IngestSummary = {
    fileName: file.name, fileKind: kind, totalRows: rows, distributors: owners.size,
    bytes: file.size, schema, headerRowCount: 1,
    startedAt: 0, finishedAt: 0, durationMs: Math.round(finished - started),
  }
  bytesRead = file.size
  bump()
  post({ type: 'done', summary })
}

// English numeric format (the real Sell_out files): dot = decimal, comma = thousands
// separator. Strip commas, keep the dot; guard non-finite → 0.
function parseTon(s: string | undefined): number {
  if (!s) return 0
  const n = Number(String(s).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function pct1(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

// ── Pipeline path — streams the file through the real resolution engine (segment + estado
// cascades, metrics, cola candidates) and posts a single rich `result` event at the end. ──
async function runPipeline(file: File) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  const seg: SegmentoContext = {
    index: buildIndex(SEEDS.diccionario),
    maestro: new Map(), // pass 1: no maestro yet
    fuzzyThreshold: 92,
    fuzzySuggestFloor: 80,
  }
  const est = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)
  const metrics = new MetricsAccumulator()
  const cola = createColaAccumulator()
  // Fuzzy matching is the only slow path — memoize segment resolution by normalizeText(crudo).
  const segCache = new Map<string, SegmentoResult>()
  const segmento: MethodTally = { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 }
  // Maestro (M2): built during the same pass from resolved rows, then used at the end to
  // recover rows whose segment never resolved but whose RIF is known — see applyMaestroRecovery.
  const maestroBuilder = new MaestroBuilder()
  const unresueltoPorRif = new Map<string, UnresueltoTally>()
  const unresueltoDistRif = new Map<string, Map<string, number>>()

  let schema: SchemaMap | null = null
  let badSchema = false
  let distCol: string | null = null
  let tonCol: string | null = null
  let mesCol: string | null = null
  let clienteCol: string | null = null
  let rows = 0
  let crudoPresent = 0
  let tonTotal = 0
  let tonSinClasificar = 0
  const owners = new Set<string>()
  const started = performance.now()
  let bytesRead = file.size
  const bump = () => post({ type: 'progress', rows, distributors: owners.size, bytesRead })

  const onHeaders = (headers: string[]) => {
    schema = detectSchema(headers)
    distCol =
      headers.find((h) => /distribuidor/i.test(h) && !/jde/i.test(h)) ??
      headers.find((h) => /distribuidor/i.test(h)) ??
      null
    tonCol = headers.find((h) => normalizeText(h) === 'TON') ?? null
    mesCol =
      headers.find((h) => normalizeText(h) === 'MES') ??
      headers.find((h) => normalizeText(h).includes('FECHA')) ??
      null
    clienteCol = headers.find((h) => normalizeText(h) === 'CLIENTE') ?? null
  }

  const onRow = (rec: Record<string, string>) => {
    const s = schema!
    const segCrudo = (s.segmentoCrudo ? rec[s.segmentoCrudo] : '') ?? ''
    const estCrudo = (s.estadoCrudo ? rec[s.estadoCrudo] : '') ?? ''
    const rif = (s.rif ? rec[s.rif] : '') ?? ''
    const ciudad = (s.ciudad ? rec[s.ciudad] : '') ?? ''
    const ton = tonCol ? parseTon(rec[tonCol]) : 0
    const distribuidor = (distCol ? rec[distCol] : '')?.trim() || 'SIN_DISTRIBUIDOR'

    const segKey = normalizeText(segCrudo)
    let segR = segCache.get(segKey)
    if (!segR) {
      segR = resolveSegmento({ rif: null, crudo: segCrudo }, seg) // maestro empty in pass 1 → rif irrelevant here
      segCache.set(segKey, segR)
    }
    const estR = resolveEstado({ rif, ciudad, estadoCrudo: estCrudo }, est)
    const flagRegistro: FlagRegistro =
      segR.flag === 'SIN_CLASIFICAR' ? 'SIN_CLASIFICAR' : estR.flag === 'SIN_ESTADO' ? 'SIN_ESTADO' : 'OK'
    const resolved: ResolvedRow = {
      segmentoN3: segR.segmentoN3,
      macroN1: segR.macroN1,
      metodoSegmento: segR.metodo,
      confianzaSegmento: segR.confianza,
      estadoStd: estR.estadoStd,
      metodoEstado: estR.metodo,
      flagRegistro,
      sugerenciaSegmento: segR.sugerencia,
      valorOriginalSegmento: segCrudo,
      valorOriginalEstado: estCrudo,
    }

    rows++
    if (s.rif) { const v = normalizeText(rif); if (v) owners.add(v) }
    if (segKey) crudoPresent++
    tonTotal += Number.isFinite(ton) ? ton : 0
    if (flagRegistro === 'SIN_CLASIFICAR') tonSinClasificar += ton
    segmento[(resolved.metodoSegmento ?? 'SIN_CLASIFICAR') as keyof MethodTally]++
    metrics.add(distribuidor, resolved, ton)
    cola.addRow(segCrudo, resolved, ton)

    // Maestro observation + unresolved-with-RIF tracking (M2).
    if (resolved.metodoSegmento === 'EXACTO' || resolved.metodoSegmento === 'FUZZY') {
      maestroBuilder.observe({
        rif,
        segmentoN3: resolved.segmentoN3 ?? '',
        macroN1: resolved.macroN1 ?? '',
        metodo: resolved.metodoSegmento,
        fechaOrden: mesCol ? parseFechaOrden(rec[mesCol]) : null,
        razonSocial: clienteCol ? rec[clienteCol] : null,
      })
    } else if (flagRegistro === 'SIN_CLASIFICAR') {
      const rifKey = normalizeRif(rif)
      if (rifKey !== '') {
        const g = unresueltoPorRif.get(rifKey)
        const safeTon = Number.isFinite(ton) ? ton : 0
        if (g) { g.count++; g.ton += safeTon }
        else unresueltoPorRif.set(rifKey, { count: 1, ton: safeTon })

        let distMap = unresueltoDistRif.get(distribuidor)
        if (!distMap) { distMap = new Map(); unresueltoDistRif.set(distribuidor, distMap) }
        distMap.set(rifKey, (distMap.get(rifKey) ?? 0) + 1)
      }
    }

    if (rows % 5000 === 0) bump()
  }

  try {
    if (kind === 'csv') {
      bytesRead = 0
      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true, skipEmptyLines: true, worker: false,
          step: (res, parser) => {
            if (!schema) {
              onHeaders(res.meta.fields ?? Object.keys(res.data))
              if (schema && !schemaIsUsable(schema)) { badSchema = true; parser.abort(); return }
            }
            if (typeof res.meta.cursor === 'number') bytesRead = res.meta.cursor
            onRow(res.data)
          },
          complete: () => resolve(),
          error: (err) => reject(err),
        })
      })
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      if (json.length) {
        onHeaders(Object.keys(json[0]))
        if (schema && !schemaIsUsable(schema)) badSchema = true
      }
      if (!badSchema) for (const rec of json) onRow(rec)
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (badSchema) return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' })
  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' })

  // End-of-pass assembly (maestro build → recovery → metrics recompute → cola/maestro shaping →
  // final result) is guarded so ANY unexpected throw still posts exactly one terminal error
  // instead of leaving runPipeline rejected with no event and the UI hung. Exactly one terminal
  // event on every path: one `result` on success here, one `error` on parse failure above or in
  // this catch.
  try {
    const finished = performance.now()
    const summary: IngestSummary = {
      fileName: file.name, fileKind: kind, totalRows: rows, distributors: owners.size,
      bytes: file.size, schema, headerRowCount: 1,
      startedAt: 0, finishedAt: 0, durationMs: Math.round(finished - started),
    }
    bytesRead = file.size
    bump()

    const totals = metrics.totals()

    // ── Maestro (M2): build the canonical client segments from this pass's resolved rows, then
    // use them to recover SIN_CLASIFICAR rows whose RIF is now known — single pass, no re-read. ──
    const { maestro, conflictos } = maestroBuilder.build()
    const recovery = applyMaestroRecovery({
      segmento,
      tonSinClasificar,
      unresueltoPorRif,
      unresueltoDistRif,
      maestro,
    })

    const distribuidores: DistribuidorRow[] = metrics.distribuidores().map((d, i) => {
      // Per-distributor recovery only ever raises the post-cascade share (scdcPost); scdcCrudo
      // (from exactoCrudo, D5) comes straight from the untouched DistribuidorMetric — the
      // distributor's raw submission never changes because of a maestro recovery.
      const recuperadosDist = recovery.recuperadosPorDist.get(d.nombre) ?? 0
      const resueltoPost = Math.min(d.resueltoPost + recuperadosDist, d.registros)
      return {
        id: `d${i}`,
        nombre: d.nombre,
        scdcCrudo: scdcCrudoPct(d),
        scdcPost: pct1(resueltoPost, d.registros),
        registros: d.registros,
        ton: d.ton,
      }
    })

    // Maestro entries for the view: sorted by rif for determinism, capped to keep the postMessage
    // payload small. maestroTotal carries the true distinct-client count.
    const maestroEntries = [...maestro.values()].sort((a, b) => a.rif.localeCompare(b.rif))

    // CONFLICTO_MAYOR → cola: cross-macro RIFs never get a maestro entry, so they need a review
    // queue item of their own (built from the maestro pass, not from row-crudo grouping).
    const conflictoItems: ColaItem[] = conflictos.map((c) => ({
      id: stableId('CONFLICTO_MAYOR', c.rif),
      tipo: 'CONFLICTO_MAYOR',
      valorCrudo: c.rif,
      registrosAfectados: c.registros,
      tonAfectadas: 0,
      sugerenciaFuzzy: null,
      resolucion: null,
    }))
    const colaMerged = [...cola.build(200), ...conflictoItems]
      .sort((a, b) => b.tonAfectadas - a.tonAfectadas)
      .slice(0, 200)

    const result: PipelineRunResult = {
      summary,
      segmento: recovery.segmento,
      clasificacionPct: pct1(rows - recovery.segmento.SIN_CLASIFICAR, rows),
      // Capped defensively: recovered rows with no crudo at all raise the numerator (now-classified
      // rows) without raising crudoPresent (rows that HAD a crudo value), which could otherwise
      // push this ratio past 100%.
      clasificacionCrudoPct: Math.min(100, pct1(rows - recovery.segmento.SIN_CLASIFICAR, crudoPresent)),
      estadoValidoPct: pct1(totals.estadoValido, rows),
      tonTotal,
      tonSinClasificar: recovery.tonSinClasificar,
      distribuidores,
      cola: colaMerged,
      maestro: maestroEntries.slice(0, 500),
      maestroTotal: maestro.size,
      conflictos: conflictos.length,
      recuperadosMaestro: recovery.recuperados,
    }
    post({ type: 'result', result })
  } catch (e) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (e as Error).message || 'Error al ensamblar el resultado' })
  }
}

// ── Export path — on-demand SECOND pass (PRD-sanctioned) that re-streams the file WITH the
// run's maestro applied (so RIF-recovered rows carry MAESTRO), and serializes the original
// columns + the 11 PRD §7.3 output columns to a CSV Blob. User-initiated and one-off, so this
// resolves each row directly via the pure processRow/outputColumns helpers — correctness over
// the pass-1 fuzzy-memoization trick (which can't be reused: resolution now depends on rif). ──
const OUTPUT_HEADER = [...OUTPUT_COLUMNS]

async function runExport(file: File, maestroEntries: MaestroEntry[], versionDiccionario: string, runId: string) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  const seg: SegmentoContext = {
    index: buildIndex(SEEDS.diccionario),
    maestro: buildMaestro(maestroEntries), // pass 2: the run's maestro IS available now
    fuzzyThreshold: 92,
    fuzzySuggestFloor: 80,
  }
  const est = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)

  let schema: SchemaMap | null = null
  let badSchema = false
  let headers: string[] = []
  let rows = 0
  const parts: string[] = []
  let bytesRead = file.size
  const bump = () => post({ type: 'progress', rows, distributors: 0, bytesRead })

  const onHeaders = (hs: string[]) => {
    headers = hs
    schema = detectSchema(hs)
    parts.push(csvLine([...headers, ...OUTPUT_HEADER]) + '\n')
  }

  const onRow = (rec: Record<string, string>) => {
    const s = schema!
    const segCrudo = (s.segmentoCrudo ? rec[s.segmentoCrudo] : '') ?? ''
    const estCrudo = (s.estadoCrudo ? rec[s.estadoCrudo] : '') ?? ''
    const rif = (s.rif ? rec[s.rif] : '') ?? ''
    const ciudad = (s.ciudad ? rec[s.ciudad] : '') ?? ''

    const resolved = processRow({ rif, segmentoCrudo: segCrudo, estadoCrudo: estCrudo, ciudad }, seg, est)
    const outCols = outputColumns(resolved, versionDiccionario, runId)
    const rowValues = headers.map((h) => rec[h] ?? '')
    const outValues = OUTPUT_HEADER.map((c) => outCols[c])
    parts.push(csvLine([...rowValues, ...outValues]) + '\n')

    rows++
    if (rows % 5000 === 0) bump()
  }

  try {
    if (kind === 'csv') {
      bytesRead = 0
      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true, skipEmptyLines: true, worker: false,
          step: (res, parser) => {
            if (!schema) {
              onHeaders(res.meta.fields ?? Object.keys(res.data))
              if (schema && !schemaIsUsable(schema)) { badSchema = true; parser.abort(); return }
            }
            if (typeof res.meta.cursor === 'number') bytesRead = res.meta.cursor
            onRow(res.data)
          },
          complete: () => resolve(),
          error: (err) => reject(err),
        })
      })
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      if (json.length) {
        onHeaders(Object.keys(json[0]))
        if (schema && !schemaIsUsable(schema)) badSchema = true
      }
      if (!badSchema) for (const rec of json) onRow(rec)
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (badSchema) return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' })
  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' })

  // Guarded so ANY unexpected throw (e.g. Blob construction) still posts exactly one terminal
  // error event instead of leaving runExport's promise hanging with no message ever posted.
  try {
    bytesRead = file.size
    bump()
    const blob = new Blob(parts, { type: 'text/csv;charset=utf-8;' })
    post({ type: 'export', blob, rows })
  } catch (e) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (e as Error).message || 'Error al generar el archivo' })
  }
}
