import type { AuditSnapshot } from './compare'

type RecordValue = Record<string, unknown>

function objectAt(value: unknown, name: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Manifiesto inválido: falta ${name}`)
  }
  return value as RecordValue
}

function stringAt(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Manifiesto inválido: falta ${name}`)
  return value
}

function numberAt(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Manifiesto inválido: ${name} debe ser numérico`)
  }
  return value
}

/** Reads only the aggregate fields needed for comparison. No customer rows are imported. */
export function parseAuditSnapshot(json: string): AuditSnapshot {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('El archivo no contiene JSON válido')
  }

  const document = objectAt(parsed, 'documento')
  if (document.schemaVersion !== 1) throw new Error('Versión de manifiesto no compatible')
  const run = objectAt(document.run, 'run')
  const source = objectAt(document.source, 'source')
  const resolution = objectAt(document.resolution, 'resolution')
  const quality = objectAt(document.quality, 'quality')

  return {
    runId: stringAt(run.id, 'run.id'),
    fileName: stringAt(source.fileName, 'source.fileName'),
    bytes: numberAt(source.bytes, 'source.bytes'),
    rows: numberAt(source.rows, 'source.rows'),
    classifiedPct: numberAt(resolution.classifiedPct, 'resolution.classifiedPct'),
    validStatePct: numberAt(resolution.validStatePct, 'resolution.validStatePct'),
    unresolvedClients: numberAt(quality.unresolvedClients, 'quality.unresolvedClients'),
    tonUnclassified: numberAt(quality.tonUnclassified, 'quality.tonUnclassified'),
  }
}
