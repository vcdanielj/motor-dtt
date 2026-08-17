/// <reference lib="webworker" />
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  schemaIsUsable,
  detectDistCol,
  detectClienteCol,
  detectMesCol,
  detectTonCol,
  findBestHeaderRow,
} from '@/ingest/schema-detect'
import { normalizeText, normalizeRif, parseNumeric, isSummaryFooterRow } from '@/ingest/normalize'
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
  detectExportExtraCols,
  observeExportRow,
  exportRowLine,
  exportHeaderLine,
  type ExportExtraCols,
} from '@/reports/export-base'
import type {
  ProgressEvent,
  IngestSummary,
  FileKind,
  MethodTally,
  EstadoTally,
  PipelineRunResult,
  ClientesSinClasificarRow,
} from '@/contracts/pipeline'
import type { DistribuidorRow } from '@/contracts/dist'
import type { ColaItem } from '@/contracts/cola'
import type { SchemaMap } from '@/contracts/row'
import type { DiccionarioEntry, EstadoDiccionarioEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'

// Recency key stamped on manual classifications (from Config import or Cola resolution) so they
// win rule D3 over any observed row from the actual file.
const MANUAL_FECHA_ORDEN = Number.MAX_SAFE_INTEGER

type WorkerMode = 'counting' | 'pipeline' | 'export'

interface WorkerRequest {
  file: File
  mode?: WorkerMode
  versionDiccionario?: string
  runId?: string
  diccionario?: DiccionarioEntry[]
  estadoDiccionario?: EstadoDiccionarioEntry[]
  ciudadEstado?: Record<string, string>
  manualMaestro?: MaestroEntry[]
  fuzzyThreshold?: number
  fuzzySuggestFloor?: number
}

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const file = ev.data?.file
  if (!file) return post({ type: 'error', code: 'UNSUPPORTED', message: 'No se recibió ningún archivo' })
  const mode = ev.data.mode ?? 'counting'
  const cfg: ResolutionConfig = {
    diccionario: ev.data.diccionario ?? SEEDS.diccionario,
    estadoDiccionario: ev.data.estadoDiccionario ?? SEEDS.estadoDiccionario,
    ciudadEstado: ev.data.ciudadEstado ?? SEEDS.ciudadEstado,
    manualMaestro: ev.data.manualMaestro ?? [],
    fuzzyThreshold: ev.data.fuzzyThreshold ?? 92,
    fuzzySuggestFloor: ev.data.fuzzySuggestFloor ?? 80,
  }
  if (mode === 'pipeline') {
    return runPipeline(file, cfg)
  }
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
  ciudadEstado: Record<string, string>
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
    SEEDS.estados,
    cfg.ciudadEstado,
    estadoByRif,
    cfg.estadoDiccionario,
    cfg.fuzzyThreshold,
    cfg.fuzzySuggestFloor,
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
// their RIF's rows, whether or not the file resolved that RIF via EXACTO/FUZZY on its own.
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

// Streams all sheets of an XLSX workbook, scanning each sheet's top rows (up to 50) for a valid header row.
// Automatically skips letterheads (membretes), pivot tables, cover sheets, notes and empty sheets.
function streamXlsx(
  buf: ArrayBuffer,
  onSheetHeaders: (headers: string[], sheetName: string, schema: SchemaMap) => boolean | void,
  onRow: (rec: Record<string, string>, sheetName: string) => void,
): { validSheets: number; totalRows: number } {
  const wb = XLSX.read(buf, { type: 'array' })
  let validSheets = 0
  let totalRows = 0

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws) continue
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
    if (!matrix.length) continue

    const bestHeader = findBestHeaderRow(matrix, 50)
    if (!bestHeader) continue

    const { headerRowIdx, headers, schema } = bestHeader
    const accept = onSheetHeaders(headers, name, schema)
    if (accept === false) continue

    validSheets++
    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r]
      if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue
      const rec: Record<string, string> = {}
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c]
        if (key) rec[key] = String(row[c] ?? '').trim()
      }
      if (isSummaryFooterRow(rec, schema.rif)) continue
      onRow(rec, name)
      totalRows++
    }
  }

  return { validSheets, totalRows }
}

// Streams CSV records handling leading letterheads (membretes) and blank lines before headers.
async function streamCsv(
  file: File,
  onHeaders: (headers: string[], schema: SchemaMap) => boolean | void,
  onRow: (rec: Record<string, string>) => void,
  onProgress?: (bytesRead: number) => void,
): Promise<{ ok: boolean; totalRows: number }> {
  let headerRowFound = false
  let headers: string[] = []
  let schema: SchemaMap | null = null
  let totalRows = 0
  const matrixBuffer: string[][] = []
  const MAX_SCAN_ROWS = 50

  return new Promise<{ ok: boolean; totalRows: number }>((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      worker: false,
      step: (res, parser) => {
        if (typeof res.meta.cursor === 'number' && onProgress) {
          onProgress(res.meta.cursor)
        }

        const row = res.data
        if (!row || !row.some((c) => String(c ?? '').trim() !== '')) return

        if (!headerRowFound) {
          matrixBuffer.push(row.map((c) => String(c ?? '').trim()))
          if (matrixBuffer.length <= MAX_SCAN_ROWS) {
            const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
            if (best) {
              headerRowFound = true
              headers = best.headers
              schema = best.schema
              const accept = onHeaders(headers, schema)
              if (accept === false) {
                parser.abort()
                resolve({ ok: false, totalRows: 0 })
                return
              }
              // Process buffered data rows after the header row
              for (let i = best.headerRowIdx + 1; i < matrixBuffer.length; i++) {
                const bRow = matrixBuffer[i]
                const rec: Record<string, string> = {}
                for (let c = 0; c < headers.length; c++) {
                  const k = headers[c]
                  if (k) rec[k] = String(bRow[c] ?? '').trim()
                }
                if (!isSummaryFooterRow(rec, schema.rif)) {
                  onRow(rec)
                  totalRows++
                }
              }
            }
          }
        } else {
          // Normal data row streaming
          const rec: Record<string, string> = {}
          for (let c = 0; c < headers.length; c++) {
            const k = headers[c]
            if (k) rec[k] = String(row[c] ?? '').trim()
          }
          if (schema && !isSummaryFooterRow(rec, schema.rif)) {
            onRow(rec)
            totalRows++
          }
        }
      },
      complete: () => {
        if (!headerRowFound && matrixBuffer.length > 0) {
          const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
          if (best) {
            headers = best.headers
            schema = best.schema
            onHeaders(headers, schema)
            for (let i = best.headerRowIdx + 1; i < matrixBuffer.length; i++) {
              const bRow = matrixBuffer[i]
              const rec: Record<string, string> = {}
              for (let c = 0; c < headers.length; c++) {
                const k = headers[c]
                if (k) rec[k] = String(bRow[c] ?? '').trim()
              }
              if (!isSummaryFooterRow(rec, schema.rif)) {
                onRow(rec)
                totalRows++
              }
            }
          }
        }
        resolve({ ok: headerRowFound && totalRows > 0, totalRows })
      },
      error: (err) => reject(err),
    })
  })
}

// ── Counting path — feeds startIngest/Corrida's live row/distributor tally. ──
async function runCounting(file: File) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  let schema: SchemaMap | null = null
  let badSchema = false
  let rows = 0
  let distCol: string | null = null
  const clientes = new Set<string>()
  const distribuidoresVistos = new Set<string>()
  const started = performance.now()
  let bytesRead = file.size
  const bump = () =>
    post({ type: 'progress', rows, distributors: distribuidoresVistos.size, clientes: clientes.size, bytesRead })

  const onHeaders = (headers: string[], s: SchemaMap) => {
    schema = s
    distCol = detectDistCol(headers)
  }

  const onRow = (rec: Record<string, string>) => {
    rows++
    if (schema?.rif) {
      const v = normalizeText(rec[schema.rif] ?? '')
      if (v) clientes.add(v)
    }
    distribuidoresVistos.add((distCol ? rec[distCol] : '')?.trim() || 'SIN_DISTRIBUIDOR')
    if (rows % 5000 === 0) bump()
  }

  try {
    if (kind === 'csv') {
      bytesRead = 0
      const res = await streamCsv(
        file,
        (hs, s) => {
          if (!schema) onHeaders(hs, s)
        },
        (rec) => {
          onRow(rec)
        },
        (cursor) => {
          bytesRead = cursor
        },
      )
      if (!res.ok) badSchema = true
    } else {
      const buf = await file.arrayBuffer()
      const res = streamXlsx(
        buf,
        (hs, _, s) => {
          if (!schema) onHeaders(hs, s)
          else distCol = detectDistCol(hs) ?? distCol
        },
        (rec) => {
          onRow(rec)
        },
      )
      if (res.validSheets === 0) badSchema = true
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (badSchema)
    return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento o estado' })
  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados válidos' })
  const finished = performance.now()
  const summary: IngestSummary = {
    fileName: file.name,
    fileKind: kind,
    totalRows: rows,
    distributors: distribuidoresVistos.size,
    clientes: clientes.size,
    bytes: file.size,
    schema,
    headerRowCount: 1,
    startedAt: 0,
    finishedAt: 0,
    durationMs: Math.round(finished - started),
  }
  bytesRead = file.size
  bump()
  post({ type: 'done', summary })
}

// ── Pipeline path — streams the file through the real resolution engine (segment + estado
// cascades, metrics, cola candidates) and posts a single rich `result` event at the end. ──
async function runPipeline(file: File, cfg: ResolutionConfig) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  const seg = buildSegmentoContext(cfg, new Map()) // pass 1: no maestro yet
  const est = buildEstadoCtx(cfg) // pass 1: no estadoByRif yet
  const metrics = new MetricsAccumulator()
  const cola = createColaAccumulator()
  const rowCache = new Map<string, ResolvedRow>()
  const ROW_CACHE_MAX = 50_000
  const segmento: MethodTally = { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 }
  const estado: EstadoTally = newEstadoTally()
  const maestroBuilder = new MaestroBuilder()
  seedManualMaestro(maestroBuilder, cfg.manualMaestro)
  const unresueltoPorRif = new Map<string, UnresueltoTally>()
  const unresueltoDistRif = new Map<string, Map<string, number>>()
  const sinEstadoPorRif = new Map<string, number>()
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
  const clientes = new Set<string>()
  const distribuidoresVistos = new Set<string>()
  const started = performance.now()
  let bytesRead = file.size
  const bump = () =>
    post({ type: 'progress', rows, distributors: distribuidoresVistos.size, clientes: clientes.size, bytesRead })

  const onHeaders = (headers: string[], s: SchemaMap) => {
    schema = s
    distCol = detectDistCol(headers)
    tonCol = detectTonCol(headers)
    mesCol = detectMesCol(headers)
    clienteCol = detectClienteCol(headers)
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
    const ton = tonCol ? parseNumeric(rec[tonCol]) : 0
    const distribuidor = (distCol ? rec[distCol] : '')?.trim() || 'SIN_DISTRIBUIDOR'

    const segKey = normalizeText(segCrudo)
    const cacheKey = `${segKey}|${normalizeText(estCrudo)}|${normalizeText(ciudad)}`
    let cached = rowCache.get(cacheKey)
    if (!cached) {
      cached = processRow({ rif: null, segmentoCrudo: segCrudo, estadoCrudo: estCrudo, ciudad }, seg, est)
      if (rowCache.size < ROW_CACHE_MAX) rowCache.set(cacheKey, cached)
    }
    const resolved: ResolvedRow = {
      ...cached,
      valorOriginalSegmento: segCrudo,
      valorOriginalEstado: estCrudo,
    }
    const flagRegistro = resolved.flagRegistro

    rows++
    if (s.rif) {
      const v = normalizeText(rif)
      if (v) clientes.add(v)
    }
    distribuidoresVistos.add(distribuidor)
    if (segKey) crudoPresent++
    tonTotal += Number.isFinite(ton) ? ton : 0
    if (flagRegistro === 'SIN_CLASIFICAR') tonSinClasificar += ton
    segmento[(resolved.metodoSegmento ?? 'SIN_CLASIFICAR') as keyof MethodTally]++
    estado[(resolved.metodoEstado ?? 'SIN_ESTADO') as keyof EstadoTally]++
    metrics.add(distribuidor, resolved, ton)
    cola.addSegmento(segCrudo, resolved, ton)
    cola.addEstado(estCrudo, resolved, ton)
    cola.addCiudad(ciudad, resolved, ton)

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
        if (!distMap) {
          distMap = new Map()
          unresueltoDistRif.set(distribuidor, distMap)
        }
        distMap.set(rifKey, (distMap.get(rifKey) ?? 0) + 1)
      }
    }

    if (resolved.estadoStd === null && rifKey !== '') {
      sinEstadoPorRif.set(rifKey, (sinEstadoPorRif.get(rifKey) ?? 0) + 1)
    }

    // Per-client pending tracking: a client is pending while ANY of its rows still lacks the
    // segment or the state.
    if (rifKey !== '') {
      const safeTon = Number.isFinite(ton) ? ton : 0
      const razonSocial = (clienteCol ? rec[clienteCol] : '') || ''
      let pendiente = clientesPendientes.get(rifKey)
      if (!pendiente) {
        pendiente = {
          distribuidor,
          rif,
          razonSocial,
          ton: 0,
          count: 0,
          faltaSegmento: false,
          faltaEstado: false,
          segmentoActual: '',
          estadoActual: '',
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
      const res = await streamCsv(
        file,
        (hs, s) => {
          if (!schema) {
            onHeaders(hs, s)
          } else {
            distCol = detectDistCol(hs) ?? distCol
            tonCol = detectTonCol(hs) ?? tonCol
            mesCol = detectMesCol(hs) ?? mesCol
            clienteCol = detectClienteCol(hs) ?? clienteCol
            schema = s
          }
        },
        (rec) => {
          onRow(rec)
        },
        (cursor) => {
          bytesRead = cursor
        },
      )
      if (!res.ok) badSchema = true
    } else {
      const buf = await file.arrayBuffer()
      const res = streamXlsx(
        buf,
        (hs, _, s) => {
          if (!schema) {
            onHeaders(hs, s)
          } else {
            distCol = detectDistCol(hs) ?? distCol
            tonCol = detectTonCol(hs) ?? tonCol
            mesCol = detectMesCol(hs) ?? mesCol
            clienteCol = detectClienteCol(hs) ?? clienteCol
            schema = s
          }
        },
        (rec) => {
          onRow(rec)
        },
      )
      if (res.validSheets === 0) badSchema = true
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (badSchema)
    return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento o estado' })
  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados válidos' })

  try {
    const finished = performance.now()
    const summary: IngestSummary = {
      fileName: file.name,
      fileKind: kind,
      totalRows: rows,
      distributors: distribuidoresVistos.size,
      clientes: clientes.size,
      bytes: file.size,
      schema,
      headerRowCount: 1,
      startedAt: 0,
      finishedAt: 0,
      durationMs: Math.round(finished - started),
    }
    bytesRead = file.size
    bump()

    const totals = metrics.totals()

    // ── Stage 5: Actualización Maestro (build canonical client map + RIF recovery) ──
    post({ type: 'stage', stageIndex: 4, status: 'running', detail: 'Construyendo maestro de clientes…' })

    const { maestro, conflictos } = maestroBuilder.build()
    const recovery = applyMaestroRecovery({
      segmento,
      tonSinClasificar,
      unresueltoPorRif,
      unresueltoDistRif,
      maestro,
    })

    const estadoRecovery = applyEstadoRecovery({ estado, sinEstadoPorRif, maestro })
    const finalEstadoValidoPct = pct1(totals.estadoValido + estadoRecovery.recuperados, rows)

    const fmt = new Intl.NumberFormat('es-VE')
    post({
      type: 'stage',
      stageIndex: 0,
      status: 'done',
      detail: `${fmt.format(rows)} filas · ${fmt.format(distribuidoresVistos.size)} distribuidores · ${fmt.format(clientes.size)} clientes`,
    })
    post({ type: 'stage', stageIndex: 1, status: 'done', detail: `${rowCache.size} combinaciones normalizadas` })
    post({
      type: 'stage',
      stageIndex: 2,
      status: 'done',
      detail: `${fmt.format(segmento.EXACTO + segmento.FUZZY)} resueltos · ${fmt.format(segmento.SIN_CLASIFICAR)} pendientes`,
    })
    post({ type: 'stage', stageIndex: 3, status: 'done', detail: `${finalEstadoValidoPct}% estado válido` })
    post({
      type: 'stage',
      stageIndex: 4,
      status: 'done',
      detail: `${maestro.size.toLocaleString('es-VE')} clientes · ${recovery.recuperados.toLocaleString('es-VE')} filas recuperadas`,
    })

    // ── Stage 6: Dedup — assemble distribuidores, deduplicated cola + final result ──
    post({ type: 'stage', stageIndex: 5, status: 'running', detail: 'Ensamblando resultado…' })

    const distribuidores: DistribuidorRow[] = metrics.distribuidores().map((d, i) => {
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

    const maestroEntries = [...maestro.values()].sort((a, b) => a.rif.localeCompare(b.rif))

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
    const colaMerged = [...cola.build(150), ...conflictoItems].slice(0, 400)

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
    post({
      type: 'stage',
      stageIndex: 5,
      status: 'done',
      detail: `${colaMerged.length.toLocaleString('es-VE')} ítems en cola · ${conflictos.length.toLocaleString('es-VE')} conflictos`,
    })
    post({ type: 'result', result })
  } catch (e) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (e as Error).message || 'Error al ensamblar el resultado' })
  }
}

// ── Export path — on-demand SECOND pass. ──
async function runExport(file: File, versionDiccionario: string, runId: string, cfg: ResolutionConfig) {
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  const est = buildEstadoCtx(cfg)

  try {
    // ── Pass A — build the full maestro ──
    const segSeed = buildSegmentoContext(cfg, new Map())
    const builder = new MaestroBuilder()
    seedManualMaestro(builder, cfg.manualMaestro)
    let schemaA: SchemaMap | null = null
    let extraCols: ExportExtraCols = { mesCol: null, clienteCol: null }
    const passA = await streamRecords(
      file,
      kind,
      (headers, s) => {
        schemaA = s
        extraCols = detectExportExtraCols(headers)
        return schemaIsUsable(schemaA)
      },
      (rec) => observeExportRow(builder, rec, schemaA!, extraCols, segSeed, est),
    )
    if (passA === 'bad-schema')
      return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento o estado' })
    const { maestro } = builder.build()

    // ── Pass B — write with the full maestro applied ──
    const seg = buildSegmentoContext(cfg, maestro)
    const estWithRif = buildEstadoCtx(cfg, estadoByRifFrom(maestro))

    let schemaB: SchemaMap | null = null
    let headers: string[] = []
    let rows = 0
    const parts: string[] = []
    const passB = await streamRecords(
      file,
      kind,
      (hs, s) => {
        headers = hs
        schemaB = s
        parts.push(exportHeaderLine(headers) + '\n')
        return schemaIsUsable(schemaB)
      },
      (rec) => {
        parts.push(exportRowLine(rec, headers, schemaB!, seg, estWithRif, versionDiccionario, runId) + '\n')
        rows++
        if (rows % 5000 === 0) post({ type: 'progress', rows, distributors: 0, clientes: 0, bytesRead: file.size })
      },
    )
    if (passB === 'bad-schema')
      return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento o estado' })
    if (rows === 0 || !schemaB) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados válidos' })

    post({ type: 'progress', rows, distributors: 0, clientes: 0, bytesRead: file.size })
    const blob = new Blob(parts, { type: 'text/csv;charset=utf-8;' })
    post({ type: 'export', blob, rows })
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message || 'Error al generar el archivo' })
  }
}

// Streams records across all valid sheets of CSV / XLSX.
async function streamRecords(
  file: File,
  kind: FileKind,
  onFirstHeaders: (headers: string[], schema: SchemaMap) => boolean,
  onRow: (rec: Record<string, string>) => void,
): Promise<'ok' | 'bad-schema'> {
  let started = false
  let badSchema = false
  if (kind === 'csv') {
    const res = await streamCsv(
      file,
      (hs, s) => {
        if (!started) {
          started = true
          if (!onFirstHeaders(hs, s)) {
            badSchema = true
            return false
          }
        }
      },
      (rec) => {
        if (!badSchema) onRow(rec)
      },
    )
    if (!res.ok) badSchema = true
  } else {
    const buf = await file.arrayBuffer()
    const res = streamXlsx(
      buf,
      (hs, _, s) => {
        if (!started) {
          started = true
          if (!onFirstHeaders(hs, s)) {
            badSchema = true
            return false
          }
        }
      },
      (rec) => {
        if (!badSchema) onRow(rec)
      },
    )
    if (res.validSheets === 0) badSchema = true
  }
  return badSchema ? 'bad-schema' : 'ok'
}
