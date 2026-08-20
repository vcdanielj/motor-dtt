/// <reference lib="webworker" />
import Papa from 'papaparse'
import {
  schemaIsUsable,
  detectDistCol,
  detectClienteCol,
  detectMesCol,
  detectTonCol,
  detectCodigoClienteCol,
  detectSucursalCol,
  findBestHeaderRow,
} from '@/ingest/schema-detect'
import { streamXlsxWorkbook } from '@/ingest/xlsx-stream'
import { normalizeText, normalizeRif, parseNumeric, isSummaryFooterRow } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import { buildIndex, type SegmentoContext } from '@/pipeline/segmento'
import { buildEstadoContext, type EstadoContext } from '@/pipeline/estado'
import { MetricsAccumulator, newEstadoTally, scdcCrudoPct } from '@/pipeline/metrics'
import { createColaAccumulator, stableId } from '@/pipeline/cola'
import { MaestroBuilder, parseFechaOrden } from '@/pipeline/maestro'
import { applyEstadoRecovery, applyMaestroRecovery, type UnresueltoTally } from '@/pipeline/recovery'
import { processRow, type ResolvedRow } from '@/pipeline/process-row'
import { buildAliasIndex, resolveAlias } from '@/pipeline/alias'
import { guardTon, pct1 } from '@/lib/num'
import {
  detectExportExtraCols,
  observeExportRow,
  exportRowValues,
  exportHeaderValues,
  type ExportExtraCols,
} from '@/reports/export-base'
import { XlsxBaseWriter } from '@/reports/xlsx-write'
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
import type { DiccionarioEntry, EstadoDiccionarioEntry, ClienteAliasEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'

// Recency key stamped on manual classifications (from Config import or Cola resolution) so they
// win rule D3 over any observed row from the actual file.
const MANUAL_FECHA_ORDEN = Number.MAX_SAFE_INTEGER

// The 24 official estados, normalized — the gate every alias-provided estado must pass before it
// can resolve a row (an alias imported with a typo'd estado must never leak into estado_std).
const ESTADO_CATALOGO = new Set(SEEDS.estados.map(normalizeText))

/** The alias's estadoStd, canonicalized, or null when absent/not a catalog estado. */
function estadoDeAlias(alias: ClienteAliasEntry | null): string | null {
  if (!alias?.estadoStd) return null
  const estado = normalizeText(alias.estadoStd)
  return ESTADO_CATALOGO.has(estado) ? estado : null
}

/** Estado-por-RIF conocido ANTES de leer el archivo: el estado habitual de las clasificaciones
 *  manuales persistidas y el "Estado Sugerido" de las homologaciones de código. Alimenta el paso
 *  RIF de la cascada de estados en el export (pasada A) y complementa al maestro en la pasada B. */
function estadoByRifSeed(cfg: ResolutionConfig): Map<string, string> {
  const seedMap = new Map<string, string>()
  for (const a of cfg.aliases) {
    if (!a.activa || !a.estadoStd) continue
    const estado = normalizeText(a.estadoStd)
    const rifKey = normalizeRif(a.rifCanonico)
    if (rifKey !== '' && ESTADO_CATALOGO.has(estado)) seedMap.set(rifKey, estado)
  }
  for (const m of cfg.manualMaestro) {
    if (!m.estadoHabitual) continue
    const rifKey = normalizeRif(m.rif)
    const estado = normalizeText(m.estadoHabitual)
    if (rifKey !== '' && ESTADO_CATALOGO.has(estado)) seedMap.set(rifKey, estado)
  }
  return seedMap
}

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
  aliases?: ClienteAliasEntry[]
  fuzzyThreshold?: number
  fuzzySuggestFloor?: number
}

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

// XLSX files are ZIP containers (magic bytes 'PK'). A legacy binary .xls (BIFF) or a renamed file
// is not — without this check JSZip failed with a cryptic "end of central directory" error.
function esZip(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  return b.length === 2 && b[0] === 0x50 && b[1] === 0x4b
}

const MSG_XLS_VIEJO =
  'El archivo no es un XLSX válido — probablemente es un .xls antiguo. Ábrelo en Excel y guárdalo como "Libro de Excel (.xlsx)", o expórtalo a CSV, y vuelve a cargarlo.'

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const file = ev.data?.file
  if (!file) return post({ type: 'error', code: 'UNSUPPORTED', message: 'No se recibió ningún archivo' })
  const mode = ev.data.mode ?? 'counting'
  const cfg: ResolutionConfig = {
    diccionario: ev.data.diccionario ?? SEEDS.diccionario,
    estadoDiccionario: ev.data.estadoDiccionario ?? SEEDS.estadoDiccionario,
    ciudadEstado: ev.data.ciudadEstado ?? SEEDS.ciudadEstado,
    manualMaestro: ev.data.manualMaestro ?? [],
    aliases: ev.data.aliases ?? [],
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
  aliases: ClienteAliasEntry[]
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
      if (!esZip(buf)) return post({ type: 'error', code: 'UNSUPPORTED', message: MSG_XLS_VIEJO })
      const res = await streamXlsxWorkbook(
        buf,
        (hs, _, s) => {
          if (!schema) {
            onHeaders(hs, s)
          } else {
            // Later sheets can carry different headers — refresh the schema so their rows count
            // clients against the right RIF column instead of sheet 1's.
            distCol = detectDistCol(hs) ?? distCol
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
  const aliasIndex = buildAliasIndex(cfg.aliases)
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
  let codClienteCol: string | null = null
  let sucursalCol: string | null = null
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
    codClienteCol = detectCodigoClienteCol(headers)
    sucursalCol = detectSucursalCol(headers)
    post({ type: 'stage', stageIndex: 0, status: 'running', detail: 'Leyendo archivo…' })
    post({ type: 'stage', stageIndex: 1, status: 'running', detail: 'Normalizando textos…' })
    post({ type: 'stage', stageIndex: 2, status: 'running', detail: 'Resolviendo segmentos…' })
    post({ type: 'stage', stageIndex: 3, status: 'running', detail: 'Resolviendo estados…' })
  }

  const onRow = (rec: Record<string, string>) => {
    const s = schema!
    const segCrudo = (s.segmentoCrudo ? rec[s.segmentoCrudo] : '') ?? ''
    const estCrudo = (s.estadoCrudo ? rec[s.estadoCrudo] : '') ?? ''
    const rawRif = (s.rif ? rec[s.rif] : '') ?? ''
    const ciudad = (s.ciudad ? rec[s.ciudad] : '') ?? ''
    // guardTon at the source: one corrupted cell (NaN or a '-3.69E+17'-style magnitude) must never
    // poison tonTotal, the per-distributor metrics or the cola priorities downstream.
    const ton = tonCol ? guardTon(parseNumeric(rec[tonCol])) : 0
    const distribuidor = (distCol ? rec[distCol] : '')?.trim() || 'SIN_DISTRIBUIDOR'

    // Alias resolution for distributor client codes lacking RIF
    let rif = rawRif
    let alias: ClienteAliasEntry | null = null
    const codCli = codClienteCol ? rec[codClienteCol] : (s.codigoCliente ? rec[s.codigoCliente] : '')
    if (!normalizeRif(rif) && codCli) {
      alias = resolveAlias(distribuidor, codCli, aliasIndex)
      if (alias) {
        rif = alias.rifCanonico
      }
    }
    const sucursalVal = sucursalCol ? rec[sucursalCol] : (s.sucursal ? rec[s.sucursal] : null)

    const segKey = normalizeText(segCrudo)
    const cacheKey = `${segKey}|${normalizeText(estCrudo)}|${normalizeText(ciudad)}`
    let cached = rowCache.get(cacheKey)
    if (!cached) {
      cached = processRow({ rif: null, segmentoCrudo: segCrudo, estadoCrudo: estCrudo, ciudad }, seg, est)
      if (rowCache.size < ROW_CACHE_MAX) rowCache.set(cacheKey, cached)
    }
    let resolved: ResolvedRow = {
      ...cached,
      valorOriginalSegmento: segCrudo,
      valorOriginalEstado: estCrudo,
    }
    // The alias's "Estado Sugerido" is an analyst-entered fact about the client — when the text
    // cascade came up empty, it resolves the row right here (same rank as the maestro's RIF step).
    const aliasEstado = estadoDeAlias(alias)
    if (aliasEstado && resolved.estadoStd === null) {
      resolved = {
        ...resolved,
        estadoStd: aliasEstado,
        metodoEstado: 'RIF',
        flagRegistro: resolved.flagRegistro === 'SIN_ESTADO' ? 'OK' : resolved.flagRegistro,
      }
    }
    const flagRegistro = resolved.flagRegistro

    rows++
    if (s.rif || rif) {
      const v = normalizeText(rif || rawRif)
      if (v) clientes.add(v)
    }
    distribuidoresVistos.add(distribuidor)
    if (segKey) crudoPresent++
    tonTotal += ton
    if (flagRegistro === 'SIN_CLASIFICAR') tonSinClasificar += ton
    segmento[(resolved.metodoSegmento ?? 'SIN_CLASIFICAR') as keyof MethodTally]++
    estado[(resolved.metodoEstado ?? 'SIN_ESTADO') as keyof EstadoTally]++
    metrics.add(distribuidor, resolved, ton)
    cola.addSegmento(segCrudo, resolved, ton)
    cola.addEstado(estCrudo, resolved, ton)
    cola.addCiudad(ciudad, resolved, ton)

    const rifKey = normalizeRif(rif)
    // Client name: the file's cliente column, or — for alias-resolved rows — the razón social
    // the analyst registered with the homologation.
    const razonSocialRow = (clienteCol ? rec[clienteCol] : '') || alias?.razonSocial || ''

    // Maestro observation + unresolved-with-RIF tracking (M2).
    if (resolved.metodoSegmento === 'EXACTO' || resolved.metodoSegmento === 'FUZZY') {
      maestroBuilder.observe({
        rif,
        segmentoN3: resolved.segmentoN3 ?? '',
        macroN1: resolved.macroN1 ?? '',
        metodo: resolved.metodoSegmento,
        fechaOrden: mesCol ? parseFechaOrden(rec[mesCol]) : null,
        razonSocial: razonSocialRow || null,
        estadoStd: resolved.estadoStd,
        sucursal: sucursalVal || null,
        ciudad: ciudad || null,
      })
    } else {
      if (resolved.estadoStd) {
        maestroBuilder.observe({
          rif,
          segmentoN3: '',
          macroN1: '',
          metodo: null,
          fechaOrden: null,
          razonSocial: razonSocialRow || null,
          estadoStd: resolved.estadoStd,
          sucursal: sucursalVal || null,
          ciudad: ciudad || null,
        })
      }
    }

    if (flagRegistro === 'SIN_CLASIFICAR') {
      if (rifKey !== '') {
        const razonSocial = razonSocialRow
        const g = unresueltoPorRif.get(rifKey)
        if (g) {
          g.count++
          g.ton += ton
          if (!g.razonSocial && razonSocial) {
            g.razonSocial = razonSocial
          }
        } else {
          unresueltoPorRif.set(rifKey, {
            count: 1,
            ton,
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
      const razonSocial = razonSocialRow
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
      pendiente.ton += ton
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
      if (!esZip(buf)) return post({ type: 'error', code: 'UNSUPPORTED', message: MSG_XLS_VIEJO })
      const res = await streamXlsxWorkbook(
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

    // Biggest conflicts first — before this sort, map order decided which conflicts survived the
    // 400-item cap, so a 2-row conflict could crowd out a 500-row one.
    const conflictoItems: ColaItem[] = [...conflictos]
      .sort((a, b) => b.registros - a.registros)
      .map((c) => ({
        id: stableId('CONFLICTO_MAYOR', c.rif),
        dominio: 'SEGMENTO' as const,
        tipo: 'CONFLICTO_MAYOR' as const,
        valorCrudo: c.rif,
        registrosAfectados: c.registros,
        tonAfectadas: 0,
        sugerenciaFuzzy: null,
        detalle: [c.razonSocial, c.segmentos.join(' vs ')].filter(Boolean).join(' · ') || null,
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

  // Homologación de códigos: the export applies the SAME alias rule as the pipeline pass, and the
  // estado cascade's RIF step starts pre-seeded with what the analyst already registered (alias
  // estados + manual maestro) so pass A's observations don't depend on the file alone.
  const aliasIndex = buildAliasIndex(cfg.aliases)
  const est = buildEstadoCtx(cfg, estadoByRifSeed(cfg))

  try {
    // Load the workbook bytes ONCE — both passes below re-stream the same buffer instead of
    // materializing the file twice (with an 800K-row XLSX that duplication alone could OOM the
    // worker, which the UI only surfaced as "No se pudo exportar").
    const xlsxBuf = kind === 'xlsx' ? await file.arrayBuffer() : null
    if (xlsxBuf && !esZip(xlsxBuf)) return post({ type: 'error', code: 'UNSUPPORTED', message: MSG_XLS_VIEJO })

    // ── Pass A — build the full maestro ──
    const segSeed = buildSegmentoContext(cfg, new Map())
    const builder = new MaestroBuilder()
    seedManualMaestro(builder, cfg.manualMaestro)
    let schemaA: SchemaMap | null = null
    let extraColsA: ExportExtraCols = { mesCol: null, clienteCol: null, sucursalCol: null, codigoClienteCol: null, distCol: null }
    await streamRecords(
      file,
      kind,
      xlsxBuf,
      (headers, s) => {
        if (!schemaIsUsable(s)) return false // skip this sheet (csv: abort the file)
        // Per-sheet schema: a multi-sheet workbook can name its columns differently on each
        // sheet, and every row must be observed against ITS sheet's columns.
        schemaA = s
        extraColsA = detectExportExtraCols(headers)
        return true
      },
      (rec) => observeExportRow(builder, rec, schemaA!, extraColsA, segSeed, est, aliasIndex),
    )
    if (!schemaA)
      return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento o estado' })
    const { maestro } = builder.build()

    // ── Pass B — write with the full maestro applied ──
    const seg = buildSegmentoContext(cfg, maestro)
    // The maestro's habitual estados (built from the file) refine the pre-seeded analyst estados.
    const estadoRifB = estadoByRifSeed(cfg)
    for (const [rifKey, estado] of estadoByRifFrom(maestro)) estadoRifB.set(rifKey, estado)
    const estWithRif = buildEstadoCtx(cfg, estadoRifB)

    let schemaB: SchemaMap | null = null
    let extraColsB: ExportExtraCols = { mesCol: null, clienteCol: null, sucursalCol: null, codigoClienteCol: null, distCol: null }
    let baseHeaders: string[] = []
    let rows = 0
    // The standardized base ships as a real XLSX. The writer streams the sheet XML in compressed
    // chunks (CompressionStream) and parks the payload in Blobs the browser can page to disk —
    // the same memory discipline as the previous chunked-CSV assembly — and rolls over to
    // "Base 2" sheets if a file ever exceeds Excel's 1.048.576-row limit.
    let xlsxWriter: XlsxBaseWriter | null = null
    await streamRecords(
      file,
      kind,
      xlsxBuf,
      (headers, s) => {
        if (!schemaIsUsable(s)) return false
        schemaB = s
        extraColsB = detectExportExtraCols(headers)
        if (!xlsxWriter) {
          // The output workbook has ONE header row: the first usable sheet's columns. Rows from
          // later sheets are projected onto it by header name; their sheet-specific extras are
          // dropped, but their classification always uses their own sheet's schema (schemaB).
          baseHeaders = headers
          xlsxWriter = new XlsxBaseWriter(exportHeaderValues(baseHeaders))
        }
        return true
      },
      (rec) => {
        xlsxWriter!.addRow(
          exportRowValues(rec, baseHeaders, schemaB!, seg, estWithRif, versionDiccionario, runId, extraColsB, aliasIndex),
        )
        rows++
        if (rows % 5000 === 0) post({ type: 'progress', rows, distributors: 0, clientes: 0, bytesRead: file.size })
      },
    )
    if (rows === 0 || !schemaB || !xlsxWriter) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados válidos' })

    post({ type: 'progress', rows, distributors: 0, clientes: 0, bytesRead: file.size })
    const blob = await (xlsxWriter as XlsxBaseWriter).finish()
    post({ type: 'export', blob, rows })
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message || 'Error al generar el archivo' })
  }
}

// Streams records across all valid sheets of CSV / XLSX. `onSheet` fires once per sheet (CSV:
// once per file) and decides whether that sheet's rows flow into `onRow`; `xlsxBuf` lets the
// caller load the workbook bytes once and reuse them across passes.
async function streamRecords(
  file: File,
  kind: FileKind,
  xlsxBuf: ArrayBuffer | null,
  onSheet: (headers: string[], schema: SchemaMap) => boolean,
  onRow: (rec: Record<string, string>) => void,
): Promise<void> {
  if (kind === 'csv') {
    let accepted = false
    await streamCsv(
      file,
      (hs, s) => {
        accepted = onSheet(hs, s)
        if (!accepted) return false // aborts the CSV parse
      },
      (rec) => {
        if (accepted) onRow(rec)
      },
    )
  } else {
    const buf = xlsxBuf ?? (await file.arrayBuffer())
    let sheetAccepted = false
    await streamXlsxWorkbook(
      buf,
      (hs, _, s) => {
        sheetAccepted = onSheet(hs, s)
        return sheetAccepted // false → xlsx-stream abandons the rest of this sheet
      },
      (rec) => {
        if (sheetAccepted) onRow(rec)
      },
    )
  }
}
