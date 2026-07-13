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

export type ProgressEvent =
  | { type: 'start'; fileName: string; fileKind: FileKind; bytes: number }
  | { type: 'progress'; rows: number; distributors: number; bytesRead: number }
  | { type: 'done'; summary: IngestSummary }
  | { type: 'error'; message: string; code: 'BAD_SCHEMA' | 'PARSE_ERROR' | 'EMPTY' | 'UNSUPPORTED' }

export interface PipelineInput { file: File }
export interface PipelineResult { summary: IngestSummary }
