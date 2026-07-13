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

// Full result of a real pipeline run (segment + estado resolution + metrics + cola candidates)
// posted by the Web Worker's `mode: 'pipeline'` path. Shapes distribuidores/cola so they match
// the mocks the views already render (anti-leak seam) — see src/contracts/dist.ts and ./cola.
export interface PipelineRunResult {
  summary: IngestSummary          // reuse existing (rows, distributors, durationMs, schema, fileName, ...)
  segmento: MethodTally
  clasificacionPct: number        // (rows - SIN_CLASIFICAR)/rows * 100, 1 decimal
  clasificacionCrudoPct: number   // among rows with crudo present
  estadoValidoPct: number
  tonTotal: number
  tonSinClasificar: number
  distribuidores: DistribuidorRow[]  // SAME shape as mocks/distribuidores.ts DistribuidorRow
  cola: ColaItem[]
}

export type ProgressEvent =
  | { type: 'start'; fileName: string; fileKind: FileKind; bytes: number }
  | { type: 'progress'; rows: number; distributors: number; bytesRead: number }
  | { type: 'done'; summary: IngestSummary }
  | { type: 'result'; result: PipelineRunResult }
  | { type: 'error'; message: string; code: 'BAD_SCHEMA' | 'PARSE_ERROR' | 'EMPTY' | 'UNSUPPORTED' }

export interface PipelineInput { file: File }
export interface PipelineResult { summary: IngestSummary }
