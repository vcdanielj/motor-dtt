/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module contracts/pipeline
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 */

import type { ResolvedRowContract, RawRowPayload } from './row';

/** Mónada de resultado seguro para operaciones de pipeline */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface PipelineExecutionMetrics {
  readonly totalRowsRead: number;
  readonly rowsProcessed: number;
  readonly tier1ExactMatches: number;
  readonly tier2FuzzyMatches: number;
  readonly tier3MasterMatches: number;
  readonly tier4Unclassified: number;
  readonly estadosRecuperadosRIF: number;
  readonly estadosRecuperadosGeo: number;
  readonly elapsedTimeMs: number;
  readonly memoryHeapUsedMB: number;
}

export interface IngestionChunkPayload {
  readonly chunkIndex: number;
  readonly totalChunks: number;
  readonly rows: ReadonlyArray<RawRowPayload>;
  readonly isFinalChunk: boolean;
}

export interface PipelineProgressEvent {
  readonly type: 'INGEST_PROGRESS' | 'CHUNK_PROCESSED' | 'PIPELINE_COMPLETE' | 'PIPELINE_ERROR';
  readonly processedCount: number;
  readonly totalCount: number;
  readonly percentage: number;
  readonly currentThroughput: number;
}

export interface SCDCScorecardResult {
  readonly distribuidorId: string;
  readonly scoreTotal: number;
  readonly tasaSegmentosNulos: number;
  readonly tasaSegmentosEstandar: number;
  readonly tasaEstadosValidos: number;
  readonly tasaDuplicados: number;
  readonly statusAuditoria: 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';
}
