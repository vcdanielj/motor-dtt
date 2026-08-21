/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module core/abstract-pipeline
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY CLEAN ARCHITECTURE TEMPLATE:
 * Define el pipeline abstracto de procesamiento en streaming por bloques,
 * manejo de contrapresión y ganchos de ciclo de vida auditables.
 */

import type { RawRowPayload, ResolvedRowContract } from '../contracts/row';
import type { PipelineExecutionMetrics, PipelineProgressEvent, Result } from '../contracts/pipeline';

export abstract class AbstractStreamPipeline {
  protected readonly runId: string;
  protected readonly startTime: number;

  constructor(runId: string) {
    this.runId = runId;
    this.startTime = Date.now();
  }

  /** Inicialización del sandbox y pre-carga de estructuras in-memory */
  public abstract initializeSandbox(): Promise<Result<void>>;

  /** Ingestión y resolución de un chunk de filas con control de memoria */
  public abstract processChunk(
    chunk: ReadonlyArray<RawRowPayload>,
  ): Promise<Result<ReadonlyArray<ResolvedRowContract>>>;

  /** Finalización determinística del pipeline y cálculo del ledger SHA-256 */
  public abstract finalizeLedger(): Promise<Result<PipelineExecutionMetrics>>;

  /** Emisión de eventos de telemetría hacia el UI Thread */
  protected notifyProgress(event: PipelineProgressEvent): void {
    if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
      self.postMessage(event);
    }
  }
}
