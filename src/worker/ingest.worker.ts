/// <reference lib="webworker" />
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectSchema } from '@/ingest/schema-detect'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import { buildIndex, type SegmentoContext } from '@/pipeline/segmento'
import { buildEstadoContext, type EstadoContext } from '@/pipeline/estado'
import { MetricsAccumulator, newEstadoTally, scdcCrudoPct } from '@/pipeline/metrics'
import { createColaAccumulator, stableId } from '@/pipeline/cola'
import { MaestroBuilder, parseFechaOrden } from '@/pipeline/maestro'
import { applyEstadoRecovery, applyMaestroRecovery, type UnresueltoTally } from '@/pipeline/recovery'
import { processRow, type ResolvedRow } from '@/pipeline/process-row'
import { pct1 } from '@/lib/num'
import {
  detectExportExtraCols, observeExportRow, exportRowLine, exportHeaderLine, type ExportExtraCols,
} from '@/reports/export-base'
import type {
  ProgressEvent, IngestSummary, FileKind, MethodTally, EstadoTally, PipelineRunResult,
  ClientesSinClasificarRow,
} from '@/contracts/pipeline'
import type { DistribuidorRow } from '@/contracts/dist'
import type { ColaItem } from '@/contracts/cola'
import type { SchemaMap } from '@/contracts/row'
import type { DiccionarioEntry, EstadoDiccionarioEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

// A schema is usable if at least one core field (RIF / segment / state) was mapped.
const schemaIsUsable = (s: SchemaMap) => s.rif !== null || s.segmentoCrudo !== null || s.estadoCrudo !== null

// A manual maestro classification always wins D3 (MANUAL > más reciente > moda) — pre-seeding the
// MaestroBuilder with a max fechaOrden guarantees it beats any row observed from the actual file.
const MANUAL_FECHA_ORDEN = Number.MAX_SAFE_INTEGER

self.onmessage = async (
  ev: MessageEvent<{
    file: File
    mode?: 'pipeline' | 'export'
    versionDiccionario?: string
    runId?: string
    // Learned config (Sprint 2 · C1): the merged dictionaries + persisted manual classifications.
    // Defaulted below so callers that omit them (existing tests, the counting path) are unaffected.
    diccionario?: DiccionarioEntry[]
    estadoDiccionario?: EstadoDiccionarioEntry[]
    manualMaestro?: MaestroEntry[]
    // Editable fuzzy thresholds (Sprint 2 · C3), persisted in IndexedDB meta. Defaulted to the
    // long-standing 92/80 so callers that omit them (existing tests, the counting path) behave
    // exactly as before.
    fuzzyThreshold?: number
    fuzzySuggestFloor?: number
  }>,
) => {
  const { file, mode } = ev.data
  const cfg: ResolutionConfig = {
    diccionario: ev.data.diccionario ?? SEEDS.diccionario,
    estadoDiccionario: ev.data.estadoDiccionario ?? SEEDS.estadoDiccionario,
    manualMaestro: ev.data.manualMaestro ?? [],
    fuzzyThreshold: ev.data.fuzzyThreshold ?? 92,
    fuzzySuggestFloor: ev.data.fuzzySuggestFloor ?? 80,
  }
  if (mode === 'pipeline') return runPipeline(file, cfg)
  if (mode === 'export') {
    return runExport(file, ev.data.versionDiccionario ?? '', ev.data.runId ?? '', cfg)
  }
  return runCounting(file)
}

// Everything the resolution cascades need, bundled so the pipeline and export branches take the
// same single argument instead of five positional ones that must stay in sync.
interface ResolutionConfig {
  diccionario: DiccionarioEntry[]
  estadoDiccionario: EstadoDiccionarioEntry[]
  manualMaestro: MaestroEntry[]
  fuzzyThreshold: number
  fuzzySuggestFloor: number
}

function buildSegmentoContext(cfg: ResolutionConfig, maestro: Map<string, MaestroEntry>): SegmentoContext {
  return {
    index: buildIndex(cfg.diccionario), // merged: SEEDS.diccionario ++ learned (learned wins)
    maestro,
    fuzzyThreshold: cfg.fuzzyThreshold,
    fuzzySuggestFloor: cfg.fuzzySuggestFloor,
  }
}

function buildEstadoCtx(cfg: ResolutionConfig, estadoByRif = new Map<string, string>()): EstadoContext {
  return buildEstadoContext(
    SEEDS.estados, SEEDS.ciudadEstado, estadoByRif, cfg.estadoDiccionario,
    cfg.fuzzyThreshold, cfg.fuzzySuggestFloor,
  )
}

/** The habitual estado of every client the maestro knows, keyed by normalized RIF — the input of
 *  the estado cascade's RIF step. */
function estadoByRifFrom(maestro: Map<string, MaestroEntry>): Map<string, string> {
  const estadoByRif = new Map<string, string>()
  for (const [rKey, entry] of maestro) {
    if (entry.estadoHabitual) estadoByRif.set(rKey, entry.estadoHabitual)
  }
  return estadoByRif
}

// Pre-seeds a MaestroBuilder with the persisted manual classifications so they win D3 and recover
// their RIF's rows, whether or not the file resolved that RIF via EXACTO/FUZZY on its own. The
// manually-assigned estado rides along so an estado-only classification (the distributor filled
// in the state but not the store type) is not silently dropped.
function seedManualMaestro(builder: MaestroBuilder, manualMaestro: MaestroEntry[]): void {
  for (const m of manualMaestro) {
    builder.observe({
      rif: m.rif,
      segmentoN3: m.segmentoN3 ?? '',
      macroN1: m.macroN1 ?? '',
      metodo: 'MANUAL',
      fechaOrden: MANUAL_FECHA_ORDEN,
      razonSocial: m.razonSocial,
      estadoStd: m.estadoHabitual,
    })
  }
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

// ── Pipeline path — streams the file through the real resolution engine (segment + estado
// cascades, metrics, cola candidates) and posts a single rich `result` event at the end. ──
async function runPipeline(file: File, cfg: ResolutionConfig) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  const seg = buildSegmentoContext(cfg, new Map()) // pass 1: no maestro yet
  const est = buildEstadoCtx(cfg)                  // pass 1: no estadoByRif yet
  const metrics = new MetricsAccumulator()
  const cola = createColaAccumulator()
  // Fuzzy matching is the only slow path — memoize whole-row resolution by the (segmento, estado,
  // ciudad) crudo triple. RIF is excluded on purpose: with an empty maestro/estadoByRif in pass 1
  // it cannot change the outcome, and including it would make the cache useless (one entry per
  // client). The end-of-pass recovery re-applies what the RIF would have contributed.
  //
  // Capped because the key space is multiplicative: a file with many distinct cities could
  // otherwise grow this without bound. Past the cap rows still resolve, just uncached.
  const rowCache = new Map<string, ResolvedRow>()
  const ROW_CACHE_MAX = 50_000
  const segmento: MethodTally = { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 }
  const estado: EstadoTally = newEstadoTally()
  // Maestro (M2): built during the same pass from resolved rows, then used at the end to
  // recover rows whose segment never resolved but whose RIF is known — see applyMaestroRecovery.
  // Pre-seeded with persisted manual classifications so they win D3 and recover their RIF's rows.
  const maestroBuilder = new MaestroBuilder()
  seedManualMaestro(maestroBuilder, cfg.manualMaestro)
  const unresueltoPorRif = new Map<string, UnresueltoTally>()
  const unresueltoDistRif = new Map<string, Map<string, number>>()
  const sinEstadoPorRif = new Map<string, number>()
  // Every client seen with a RIF, so the "pending" template can list clients missing EITHER field.
  // Kept per RIF (not per row) so it stays bounded by the client count, not the row count.
  const clientesPendientes = new Map<string, ClientesSinClasificarRow>()

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
    // Stages 1-4 all happen row-by-row in the same streaming pass — mark them all as running
    // once we have confirmed headers so the user sees the progress in the StageBar.
    post({ type: 'stage', stageIndex: 0, status: 'running', detail: 'Leyendo archivo…' })
    post({ type: 'stage', stageIndex: 1, status: 'running', detail: 'Normalizando textos…' })
    post({ type: 'stage', stageIndex: 2, status: 'running', detail: 'Resolviendo segmentos…' })
    post({ type: 'stage', stageIndex: 3, status: 'running', detail: 'Resolviendo estados…' })
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
    // '|' is safe as the separator: normalizeText rewrites it to ' / ', so no part can contain
    // one and ('A B','C') cannot collide with ('A','B C') the way a space separator would allow.
    const cacheKey = `${segKey}|${normalizeText(estCrudo)}|${normalizeText(ciudad)}`
    let cached = rowCache.get(cacheKey)
    if (!cached) {
      // rif is null on purpose — see the rowCache comment above.
      cached = processRow({ rif: null, segmentoCrudo: segCrudo, estadoCrudo: estCrudo, ciudad }, seg, est)
      if (rowCache.size < ROW_CACHE_MAX) rowCache.set(cacheKey, cached)
    }
    // The cached ResolvedRow carries the crudo values of the FIRST row that produced it; those are
    // identical up to normalization but not byte-identical, and the export column must echo this
    // row's own text.
    const resolved: ResolvedRow = {
      ...cached,
      valorOriginalSegmento: segCrudo,
      valorOriginalEstado: estCrudo,
    }
    const flagRegistro = resolved.flagRegistro

    rows++
    if (s.rif) { const v = normalizeText(rif); if (v) owners.add(v) }
    if (segKey) crudoPresent++
    tonTotal += Number.isFinite(ton) ? ton : 0
    if (flagRegistro === 'SIN_CLASIFICAR') tonSinClasificar += ton
    segmento[(resolved.metodoSegmento ?? 'SIN_CLASIFICAR') as keyof MethodTally]++
    estado[(resolved.metodoEstado ?? 'SIN_ESTADO') as keyof EstadoTally]++
    metrics.add(distribuidor, resolved, ton)
    cola.addSegmento(segCrudo, resolved, ton)
    cola.addEstado(estCrudo, resolved, ton)

    const rifKey = normalizeRif(rif)

    // Maestro observation + unresolved-with-RIF tracking (M2).
    if (resolved.metodoSegmento === 'EXACTO' || resolved.metodoSegmento === 'FUZZY') {
      maestroBuilder.observe({
        rif,
        segmentoN3: resolved.segmentoN3 ?? '',
        macroN1: resolved.macroN1 ?? '',
        metodo: resolved.metodoSegmento,
        fechaOrden: mesCol ? parseFechaOrden(rec[mesCol]) : null,
        razonSocial: clienteCol ? rec[clienteCol] : null,
        estadoStd: resolved.estadoStd,
      })
    } else {
      if (resolved.estadoStd) {
        maestroBuilder.observe({
          rif,
          segmentoN3: '',
          macroN1: '',
          metodo: null,
          fechaOrden: null,
          razonSocial: clienteCol ? rec[clienteCol] : null,
          estadoStd: resolved.estadoStd,
        })
      }
    }

    if (flagRegistro === 'SIN_CLASIFICAR') {
      if (rifKey !== '') {
        const safeTon = Number.isFinite(ton) ? ton : 0
        const razonSocial = (clienteCol ? rec[clienteCol] : '') || ''
        const g = unresueltoPorRif.get(rifKey)
        if (g) {
          g.count++
          g.ton += safeTon
          if (!g.razonSocial && razonSocial) {
            g.razonSocial = razonSocial
          }
        } else {
          unresueltoPorRif.set(rifKey, {
            count: 1,
            ton: safeTon,
            rif,
            razonSocial,
            distribuidor,
          })
        }

        let distMap = unresueltoDistRif.get(distribuidor)
        if (!distMap) { distMap = new Map(); unresueltoDistRif.set(distribuidor, distMap) }
        distMap.set(rifKey, (distMap.get(rifKey) ?? 0) + 1)
      }
    }

    if (resolved.estadoStd === null && rifKey !== '') {
      sinEstadoPorRif.set(rifKey, (sinEstadoPorRif.get(rifKey) ?? 0) + 1)
    }

    // Per-client pending tracking: a client is pending while ANY of its rows still lacks the
    // segment or the state. A later row that DOES resolve a field clears that field's flag, so
    // the template never asks for something the file already answered elsewhere.
    if (rifKey !== '') {
      const safeTon = Number.isFinite(ton) ? ton : 0
      const razonSocial = (clienteCol ? rec[clienteCol] : '') || ''
      let pendiente = clientesPendientes.get(rifKey)
      if (!pendiente) {
        pendiente = {
          distribuidor, rif, razonSocial, ton: 0, count: 0,
          faltaSegmento: false, faltaEstado: false, segmentoActual: '', estadoActual: '',
        }
        clientesPendientes.set(rifKey, pendiente)
      }
      pendiente.ton += safeTon
      pendiente.count += 1
      if (!pendiente.razonSocial && razonSocial) pendiente.razonSocial = razonSocial
      if (resolved.segmentoN3) pendiente.segmentoActual = resolved.segmentoN3
      else pendiente.faltaSegmento = true
      if (resolved.estadoStd) pendiente.estadoActual = resolved.estadoStd
      else pendiente.faltaEstado = true
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

    // ── Stage 5: Actualización Maestro (build canonical client map + RIF recovery) ──
    post({ type: 'stage', stageIndex: 4, status: 'running', detail: 'Construyendo maestro de clientes…' })

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

    // RIF-based state recovery — the estado twin of applyMaestroRecovery. The pipeline pass builds
    // the maestro from the very stream it is resolving, so the cascade's RIF step could not fire
    // inline; this makes the reported numbers match what the exported file will contain.
    const estadoRecovery = applyEstadoRecovery({ estado, sinEstadoPorRif, maestro })
    const finalEstadoValidoPct = pct1(totals.estadoValido + estadoRecovery.recuperados, rows)

    // Stages 1-4 are done — stream is finished, all row-level resolution complete.
    const fmt = new Intl.NumberFormat('es-VE')
    post({ type: 'stage', stageIndex: 0, status: 'done', detail: `${fmt.format(rows)} filas · ${fmt.format(owners.size)} distribuidores` })
    post({ type: 'stage', stageIndex: 1, status: 'done', detail: `${rowCache.size} combinaciones normalizadas` })
    post({ type: 'stage', stageIndex: 2, status: 'done', detail: `${fmt.format(segmento.EXACTO + segmento.FUZZY)} resueltos · ${fmt.format(segmento.SIN_CLASIFICAR)} pendientes` })
    post({ type: 'stage', stageIndex: 3, status: 'done', detail: `${finalEstadoValidoPct}% estado válido` })

    post({ type: 'stage', stageIndex: 4, status: 'done', detail: `${maestro.size.toLocaleString('es-VE')} clientes · ${recovery.recuperados.toLocaleString('es-VE')} filas recuperadas` })

    // ── Stage 6: Dedup — assemble distribuidores, deduplicated cola + final result ──
    post({ type: 'stage', stageIndex: 5, status: 'running', detail: 'Ensamblando resultado…' })

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
      dominio: 'SEGMENTO',
      tipo: 'CONFLICTO_MAYOR',
      valorCrudo: c.rif,
      registrosAfectados: c.registros,
      tonAfectadas: 0,
      sugerenciaFuzzy: null,
      resolucion: null,
    }))
    // cola.build caps per domain, so unresolved states can never be crowded out by a long tail of
    // unresolved segments. Conflicts are appended whole — they are bounded by the client count.
    const colaMerged = [...cola.build(150), ...conflictoItems]
      .sort((a, b) => b.tonAfectadas - a.tonAfectadas)
      .slice(0, 400)

    // A client is still pending if the maestro could not fill in what its rows were missing:
    // no maestro segment covers faltaSegmento, no habitual estado covers faltaEstado.
    const clientesSinClasificar: ClientesSinClasificarRow[] = []
    for (const [rKey, pendiente] of clientesPendientes) {
      const entry = maestro.get(rKey)
      const faltaSegmento = pendiente.faltaSegmento && !entry?.segmentoN3
      const faltaEstado = pendiente.faltaEstado && !entry?.estadoHabitual
      if (!faltaSegmento && !faltaEstado) continue
      clientesSinClasificar.push({
        ...pendiente,
        razonSocial: pendiente.razonSocial || 'SIN RAZÓN SOCIAL',
        faltaSegmento,
        faltaEstado,
        segmentoActual: pendiente.segmentoActual || entry?.segmentoN3 || '',
        estadoActual: pendiente.estadoActual || entry?.estadoHabitual || '',
      })
    }
    clientesSinClasificar.sort((a, b) => b.ton - a.ton)

    const result: PipelineRunResult = {
      summary,
      segmento: recovery.segmento,
      estado: estadoRecovery.estado,
      clasificacionPct: pct1(rows - recovery.segmento.SIN_CLASIFICAR, rows),
      // Capped defensively: recovered rows with no crudo at all raise the numerator (now-classified
      // rows) without raising crudoPresent (rows that HAD a crudo value), which could otherwise
      // push this ratio past 100%.
      clasificacionCrudoPct: Math.min(100, pct1(rows - recovery.segmento.SIN_CLASIFICAR, crudoPresent)),
      estadoValidoPct: finalEstadoValidoPct,
      tonTotal,
      tonSinClasificar: recovery.tonSinClasificar,
      distribuidores,
      cola: colaMerged,
      maestro: maestroEntries.slice(0, 500),
      maestroTotal: maestro.size,
      conflictos: conflictos.length,
      recuperadosMaestro: recovery.recuperados,
      recuperadosEstado: estadoRecovery.recuperados,
      clientesSinClasificar,
    }
    post({ type: 'stage', stageIndex: 5, status: 'done', detail: `${colaMerged.length.toLocaleString('es-VE')} ítems en cola · ${conflictos.length.toLocaleString('es-VE')} conflictos` })
    post({ type: 'result', result })
  } catch (e) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (e as Error).message || 'Error al ensamblar el resultado' })
  }
}

// ── Export path — on-demand SECOND pass (PRD-sanctioned). SELF-SUFFICIENT: it re-streams the
// file TWICE rather than trusting a caller-supplied maestro. Pass A builds the FULL run maestro
// from EXACTO/FUZZY rows (seeds only) — NOT the 500-capped Maestro-view array, so on real data
// (~34K clients) every RIF-recoverable row is covered, not just the first 500. Pass B re-streams
// with that full maestro applied (recovered RIFs → MAESTRO) and serializes original columns + the
// 11 PRD §7.3 output columns to a CSV Blob. User-initiated and one-off, so two file reads is fine
// — correctness over speed. Does not touch the pipeline/counting branches. The whole thing is
// guarded so any throw posts exactly one terminal event. ──
async function runExport(file: File, versionDiccionario: string, runId: string, cfg: ResolutionConfig) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  const est = buildEstadoCtx(cfg)

  try {
    // ── Pass A — build the full maestro (segment resolved with the merged index; maestro empty
    // aside from the pre-seeded manual classifications, which win D3 regardless of what Pass A
    // observes from the file). ──
    const segSeed = buildSegmentoContext(cfg, new Map())
    const builder = new MaestroBuilder()
    seedManualMaestro(builder, cfg.manualMaestro)
    let schemaA: SchemaMap | null = null
    let extraCols: ExportExtraCols = { mesCol: null, clienteCol: null }
    const passA = await streamRecords(
      file, kind,
      (headers) => {
        schemaA = detectSchema(headers)
        extraCols = detectExportExtraCols(headers)
        return schemaIsUsable(schemaA)
      },
      (rec) => observeExportRow(builder, rec, schemaA!, extraCols, segSeed, est),
    )
    if (passA === 'bad-schema') return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' })
    const { maestro } = builder.build()

    // ── Pass B — write with the full maestro applied, for BOTH fields: segments come from the
    // maestro map, states from each client's habitual estado. ──
    const seg = buildSegmentoContext(cfg, maestro)
    const estWithRif = buildEstadoCtx(cfg, estadoByRifFrom(maestro))

    let schemaB: SchemaMap | null = null
    let headers: string[] = []
    let rows = 0
    const parts: string[] = []
    const passB = await streamRecords(
      file, kind,
      (hs) => {
        headers = hs
        schemaB = detectSchema(hs)
        parts.push(exportHeaderLine(headers) + '\n')
        return schemaIsUsable(schemaB)
      },
      (rec) => {
        parts.push(exportRowLine(rec, headers, schemaB!, seg, estWithRif, versionDiccionario, runId) + '\n')
        rows++
        if (rows % 5000 === 0) post({ type: 'progress', rows, distributors: 0, bytesRead: file.size })
      },
    )
    if (passB === 'bad-schema') return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' })
    if (rows === 0 || !schemaB) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' })

    post({ type: 'progress', rows, distributors: 0, bytesRead: file.size })
    const blob = new Blob(parts, { type: 'text/csv;charset=utf-8;' })
    post({ type: 'export', blob, rows })
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message || 'Error al generar el archivo' })
  }
}

// Streams a CSV/XLSX file's records: invokes onFirstHeaders once (return false → abort as bad
// schema) then onRow per row. Returns 'ok' or 'bad-schema'; throws on parse error so the export's
// single try/catch turns it into one terminal error event. Used only by the export path — the
// counting/pipeline branches keep their own inline streaming untouched.
async function streamRecords(
  file: File,
  kind: FileKind,
  onFirstHeaders: (headers: string[]) => boolean,
  onRow: (rec: Record<string, string>) => void,
): Promise<'ok' | 'bad-schema'> {
  let started = false
  let badSchema = false
  if (kind === 'csv') {
    await new Promise<void>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true, skipEmptyLines: true, worker: false,
        step: (res, parser) => {
          if (!started) {
            started = true
            if (!onFirstHeaders(res.meta.fields ?? Object.keys(res.data))) { badSchema = true; parser.abort(); return }
          }
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
      started = true
      if (!onFirstHeaders(Object.keys(json[0]))) badSchema = true
    }
    if (!badSchema) for (const rec of json) onRow(rec)
  }
  return badSchema ? 'bad-schema' : 'ok'
}
