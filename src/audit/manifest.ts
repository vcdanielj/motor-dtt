import type { PipelineRunResult } from '@/contracts/pipeline'
import type { RunAuditManifest } from './contracts'
import { checkRunResult } from './checks'

export interface AuditContext {
  runId: string
  dictionaryVersion: string
  fuzzyThreshold: number
  fuzzySuggestFloor: number
}

/** Builds a portable account of one run from its actual result and captured settings.
 * It intentionally contains aggregate counts and column names, never row values. */
export function buildRunAuditManifest(result: PipelineRunResult, context: AuditContext): RunAuditManifest {
  const { summary } = result
  return {
    schemaVersion: 1,
    run: {
      id: context.runId,
      dictionaryVersion: context.dictionaryVersion,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      durationMs: summary.durationMs,
    },
    source: {
      fileName: summary.fileName,
      fileKind: summary.fileKind,
      bytes: summary.bytes,
      rows: summary.totalRows,
      distributors: summary.distributors,
      clients: summary.clientes,
      schema: {
        ...summary.schema,
        passthrough: [...summary.schema.passthrough],
        unmapped: [...summary.schema.unmapped],
      },
    },
    resolution: {
      thresholds: {
        fuzzyThreshold: context.fuzzyThreshold,
        fuzzySuggestFloor: context.fuzzySuggestFloor,
      },
      segmentMethods: { ...result.segmento },
      stateMethods: { ...result.estado },
      classifiedPct: result.clasificacionPct,
      sourceClassifiedPct: result.clasificacionCrudoPct,
      validStatePct: result.estadoValidoPct,
    },
    quality: {
      tonTotal: result.tonTotal,
      tonUnclassified: result.tonSinClasificar,
      reviewItems: result.cola.length,
      unresolvedClients: result.clientesSinClasificar.length,
      conflicts: result.conflictos,
      recoveredSegmentRows: result.recuperadosMaestro,
      recoveredStateRows: result.recuperadosEstado,
    },
    checks: checkRunResult(result),
  }
}
