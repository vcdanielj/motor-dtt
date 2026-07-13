/// <reference lib="webworker" />
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectSchema } from '@/ingest/schema-detect'
import { normalizeText } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import { buildIndex, resolveSegmento, type SegmentoContext, type SegmentoResult } from '@/pipeline/segmento'
import { buildEstadoContext, resolveEstado } from '@/pipeline/estado'
import { MetricsAccumulator, scdcCrudoPct, scdcPostPct } from '@/pipeline/metrics'
import { createColaAccumulator } from '@/pipeline/cola'
import type { ResolvedRow } from '@/pipeline/process-row'
import type { ProgressEvent, IngestSummary, FileKind, MethodTally, PipelineRunResult } from '@/contracts/pipeline'
import type { DistribuidorRow } from '@/contracts/dist'
import type { FlagRegistro, SchemaMap } from '@/contracts/row'

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

// A schema is usable if at least one core field (RIF / segment / state) was mapped.
const schemaIsUsable = (s: SchemaMap) => s.rif !== null || s.segmentoCrudo !== null || s.estadoCrudo !== null

self.onmessage = async (ev: MessageEvent<{ file: File; mode?: 'pipeline' }>) => {
  const { file, mode } = ev.data
  if (mode === 'pipeline') return runPipeline(file)
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

  let schema: SchemaMap | null = null
  let badSchema = false
  let distCol: string | null = null
  let tonCol: string | null = null
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

  const finished = performance.now()
  const summary: IngestSummary = {
    fileName: file.name, fileKind: kind, totalRows: rows, distributors: owners.size,
    bytes: file.size, schema, headerRowCount: 1,
    startedAt: 0, finishedAt: 0, durationMs: Math.round(finished - started),
  }
  bytesRead = file.size
  bump()

  const totals = metrics.totals()
  const distribuidores: DistribuidorRow[] = metrics.distribuidores().map((d, i) => ({
    id: `d${i}`,
    nombre: d.nombre,
    scdcCrudo: scdcCrudoPct(d),
    scdcPost: scdcPostPct(d),
    registros: d.registros,
    ton: d.ton,
  }))

  const result: PipelineRunResult = {
    summary,
    segmento,
    clasificacionPct: pct1(rows - segmento.SIN_CLASIFICAR, rows),
    clasificacionCrudoPct: pct1(rows - segmento.SIN_CLASIFICAR, crudoPresent),
    estadoValidoPct: pct1(totals.estadoValido, rows),
    tonTotal,
    tonSinClasificar,
    distribuidores,
    cola: cola.build(200),
  }
  post({ type: 'result', result })
}
