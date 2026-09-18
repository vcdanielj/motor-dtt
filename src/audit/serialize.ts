import type { RunAuditManifest } from './contracts'

export function auditFileName(runId: string): string {
  const safeId = runId.replace(/[^A-Za-z0-9_-]/g, '_')
  return `manifiesto_corrida_${safeId}.json`
}

export function auditBlob(manifest: RunAuditManifest): Blob {
  return new Blob([JSON.stringify(manifest, null, 2) + '\n'], { type: 'application/json;charset=utf-8' })
}
