import type { SchemaMap } from '@/contracts/row'
import type { EstadoTally, FileKind, MethodTally } from '@/contracts/pipeline'

export interface AuditCheck {
  id: 'segment-balance' | 'state-balance' | 'percentage-range' | 'review-bound'
  passed: boolean
  expected: number | string
  actual: number | string
  detail: string
}

/** Summary metadata only: no transaction rows or client identifiers. */
export interface RunAuditManifest {
  schemaVersion: 1
  run: {
    id: string
    dictionaryVersion: string
    startedAt: number
    finishedAt: number
    durationMs: number
  }
  source: {
    fileName: string
    fileKind: FileKind
    bytes: number
    rows: number
    distributors: number
    clients: number
    schema: SchemaMap
  }
  resolution: {
    thresholds: { fuzzyThreshold: number; fuzzySuggestFloor: number }
    segmentMethods: MethodTally
    stateMethods: EstadoTally
    classifiedPct: number
    sourceClassifiedPct: number
    validStatePct: number
  }
  quality: {
    tonTotal: number
    tonUnclassified: number
    reviewItems: number
    unresolvedClients: number
    conflicts: number
    recoveredSegmentRows: number
    recoveredStateRows: number
  }
  checks: AuditCheck[]
}
