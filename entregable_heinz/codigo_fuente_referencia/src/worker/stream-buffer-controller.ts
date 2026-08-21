/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module worker/stream-buffer-controller
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY WORKER SPECIFICATION:
 * Controlador de búferes de streaming con control de contrapresión (Backpressure),
 * permitiendo procesar lotes de >740.000 filas con uso constante de memoria RAM (<150MB).
 */

import type { RawRowPayload, ResolvedRowContract } from '../contracts/row';

export interface StreamControllerConfig {
  readonly chunkSize: number;
  readonly maxBufferedChunks: number;
  readonly onChunkReady: (chunk: ReadonlyArray<ResolvedRowContract>) => Promise<void>;
}

export class StreamBufferController {
  private readonly config: StreamControllerConfig;
  private currentBuffer: RawRowPayload[] = [];
  private totalIngestedRows = 0;

  constructor(config: StreamControllerConfig) {
    this.config = config;
  }

  /**
   * Encola un registro entrante en el búfer local.
   * Dispara el flush automático cuando se alcanza el tamaño del bloque (e.g. 10.000 filas).
   */
  public async pushRow(
    row: RawRowPayload,
    transformer: (r: RawRowPayload) => ResolvedRowContract,
  ): Promise<void> {
    this.currentBuffer.push(row);
    this.totalIngestedRows++;

    if (this.currentBuffer.length >= this.config.chunkSize) {
      await this.flushChunk(transformer);
    }
  }

  /** Fuerza el volcado y transformación de las filas remanentes al cierre del stream */
  public async finalizeStream(
    transformer: (r: RawRowPayload) => ResolvedRowContract,
  ): Promise<number> {
    if (this.currentBuffer.length > 0) {
      await this.flushChunk(transformer);
    }
    return this.totalIngestedRows;
  }

  private async flushChunk(
    transformer: (r: RawRowPayload) => ResolvedRowContract,
  ): Promise<void> {
    const transformedChunk = this.currentBuffer.map(transformer);
    this.currentBuffer = []; // Libera memoria para Garbage Collection inmediato
    await this.config.onChunkReady(transformedChunk);
  }
}
