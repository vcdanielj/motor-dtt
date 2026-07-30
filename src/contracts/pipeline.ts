import type { DistribuidorRow } from './dist'
import type { ColaItem } from './cola'

export type FileKind = 'csv' | 'xlsx'

export interface IngestSummary {
  fileName: string
  fileKind: FileKind
  totalRows: number
  distributors: number       // distinct RIF-owner/distributor count seen during stream
  bytes: number
  schema: import('./row').SchemaMap
  headerRowCount: number
  startedAt: number          // epoch ms, stamped by caller
  finishedAt: number
  durationMs: number
}

// Per-method row counts for segment resolution (MAESTRO/EXACTO/FUZZY cascade + unresolved).
export interface MethodTally { MAESTRO: number; EXACTO: number; FUZZY: number; SIN_CLASIFICAR: number }

// Per-method row counts for state resolution. One bucket per MetodoEstado plus the unresolved
// bucket — DICCIONARIO and FUZZY used to have no bucket at all, so fuzzy-resolved states were
// miscounted as SIN_ESTADO.
export interface EstadoTally {
  EXACTO: number
  DICCIONARIO: number
  RIF: number
  CIUDAD: number
  FUZZY: number
  SIN_ESTADO: number
}

// One client the distributor still has to complete. `faltaSegmento`/`faltaEstado` say WHICH field
// is missing (at least one is always true); `segmentoActual`/`estadoActual` carry what the motor
// already knows, so the template can pre-fill the column that isn't being asked for.
export interface ClientesSinClasificarRow {
  distribuidor: string
  rif: string
  razonSocial: string
  ton: number
  count: number
  faltaSegmento: boolean
  faltaEstado: boolean
  segmentoActual: string
  estadoActual: string
}

// Full result of a real pipeline run (segment + estado resolution + metrics + cola candidates)
// posted by the Web Worker's `mode: 'pipeline'` path. Shapes distribuidores/cola so they match
// the mocks the views already render (anti-leak seam) — see src/contracts/dist.ts and ./cola.
export interface PipelineRunResult {
  summary: IngestSummary          // reuse existing (rows, distributors, durationMs, schema, fileName, ...)
  segmento: MethodTally
  estado: EstadoTally             // per-method state resolution counts (post-recovery)
  clasificacionPct: number        // (rows - SIN_CLASIFICAR)/rows * 100, 1 decimal
  clasificacionCrudoPct: number   // among rows with crudo present
  estadoValidoPct: number
  tonTotal: number
  tonSinClasificar: number
  distribuidores: DistribuidorRow[]  // SAME shape as mocks/distribuidores.ts DistribuidorRow
  cola: ColaItem[]
  maestro: import('./maestro').MaestroEntry[]   // for the Maestro view (capped to 500, see worker)
  maestroTotal: number                          // total distinct clients classified in the maestro
  conflictos: number                            // count of CONFLICTO_MAYOR (also surfaced in cola)
  recuperadosMaestro: number                    // segment rows recovered by RIF this run
  recuperadosEstado: number                     // state rows recovered by RIF this run
  clientesSinClasificar: ClientesSinClasificarRow[]
}

// Stage status emitted by the pipeline worker so the StageBar can reflect real progress.
export type StageStatus = 'running' | 'done'

export type ProgressEvent =
  | { type: 'start'; fileName: string; fileKind: FileKind; bytes: number }
  | { type: 'progress'; rows: number; distributors: number; bytesRead: number }
  | { type: 'done'; summary: IngestSummary }
  | { type: 'result'; result: PipelineRunResult }
  // Per-stage progress: stageIndex is 0-based (0=Ingesta … 5=Dedup), detail is an optional
  // human-readable string shown below the stage label (e.g. row counts after stream ends).
  | { type: 'stage'; stageIndex: number; status: StageStatus; detail?: string }
  // On-demand export pass (mode:'export'): the standardized base as a CSV Blob (structured-
  // cloneable worker→main), kept separate from `result` since it's a distinct terminal event.
  | { type: 'export'; blob: Blob; rows: number }
  | { type: 'error'; message: string; code: 'BAD_SCHEMA' | 'PARSE_ERROR' | 'EMPTY' | 'UNSUPPORTED' }

export interface PipelineInput { file: File }
export interface PipelineResult { summary: IngestSummary }
