import type { RunAuditManifest } from './contracts'

export interface AuditSnapshot {
  runId: string
  fileName: string
  bytes: number
  rows: number
  classifiedPct: number
  validStatePct: number
  unresolvedClients: number
  tonUnclassified: number
}

export interface AuditComparison {
  previousRunId: string
  currentRunId: string
  sameSourceMetadata: boolean
  delta: {
    rows: number
    classifiedPercentagePoints: number
    validStatePercentagePoints: number
    unresolvedClients: number
    tonUnclassified: number
  }
}

export function snapshotOf(manifest: RunAuditManifest): AuditSnapshot {
  return {
    runId: manifest.run.id,
    fileName: manifest.source.fileName,
    bytes: manifest.source.bytes,
    rows: manifest.source.rows,
    classifiedPct: manifest.resolution.classifiedPct,
    validStatePct: manifest.resolution.validStatePct,
    unresolvedClients: manifest.quality.unresolvedClients,
    tonUnclassified: manifest.quality.tonUnclassified,
  }
}

/** A filename and byte count are useful context, but do not prove identical file contents. */
export function compareAuditSnapshots(current: AuditSnapshot, previous: AuditSnapshot): AuditComparison {
  return {
    previousRunId: previous.runId,
    currentRunId: current.runId,
    sameSourceMetadata: current.fileName === previous.fileName && current.bytes === previous.bytes,
    delta: {
      rows: current.rows - previous.rows,
      classifiedPercentagePoints: current.classifiedPct - previous.classifiedPct,
      validStatePercentagePoints: current.validStatePct - previous.validStatePct,
      unresolvedClients: current.unresolvedClients - previous.unresolvedClients,
      tonUnclassified: current.tonUnclassified - previous.tonUnclassified,
    },
  }
}
