import { buildRunAuditManifest } from '@/audit/manifest'
import { auditFileName } from '@/audit/serialize'
import { compareAuditSnapshots, snapshotOf } from '@/audit/compare'
import { parseAuditSnapshot } from '@/audit/parse'
import type { PipelineRunResult } from '@/contracts/pipeline'

const result: PipelineRunResult = {
  summary: {
    fileName: 'ventas.csv', fileKind: 'csv', totalRows: 3, distributors: 1, clientes: 2,
    bytes: 128, schema: {
      rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'ESTADO', ciudad: null,
      passthrough: ['TON'], unmapped: [],
    },
    headerRowCount: 1, startedAt: 100, finishedAt: 150, durationMs: 50,
  },
  segmento: { MAESTRO: 1, EXACTO: 1, FUZZY: 0, SIN_CLASIFICAR: 1 },
  estado: { EXACTO: 1, DICCIONARIO: 1, RIF: 0, CIUDAD: 0, FUZZY: 0, SIN_ESTADO: 1 },
  clasificacionPct: 66.7, clasificacionCrudoPct: 33.3, estadoValidoPct: 66.7,
  tonTotal: 10, tonSinClasificar: 2,
  distribuidores: [], cola: [],
  maestro: [{
    rif: 'J-999', razonSocial: 'CLIENTE CONFIDENCIAL', segmentoN3: 'BODEGA',
    macroN1: 'TRADICIONAL', metodo: 'MAESTRO', confianza: 'N3', estadoHabitual: null,
    fechaClasificacion: null, reglaCanonica: 'RECIENTE',
  }],
  maestroTotal: 1, conflictos: 0, recuperadosMaestro: 1, recuperadosEstado: 0,
  clientesSinClasificar: [],
}

const context = { runId: 'run-100', dictionaryVersion: 'v1', fuzzyThreshold: 92, fuzzySuggestFloor: 80 }

test('audit manifest records aggregate evidence and excludes client rows', () => {
  const manifest = buildRunAuditManifest(result, context)
  expect(manifest.schemaVersion).toBe(1)
  expect(manifest.source.rows).toBe(3)
  expect(manifest.resolution.thresholds).toEqual({ fuzzyThreshold: 92, fuzzySuggestFloor: 80 })
  expect(manifest.checks.every((check) => check.passed)).toBe(true)
  expect(JSON.stringify(manifest)).not.toContain('J-999')
  expect(JSON.stringify(manifest)).not.toContain('CLIENTE CONFIDENCIAL')
})

test('audit checks report an inconsistent state tally without changing the run', () => {
  const inconsistent = {
    ...result,
    estado: { ...result.estado, SIN_ESTADO: 0 },
  }
  const manifest = buildRunAuditManifest(inconsistent, context)
  expect(manifest.checks.find((check) => check.id === 'state-balance')).toMatchObject({
    passed: false, expected: 3, actual: 2,
  })
  expect(result.estado.SIN_ESTADO).toBe(1)
})

test('audit download name cannot contain path separators', () => {
  expect(auditFileName('run/100:abc')).toBe('manifiesto_corrida_run_100_abc.json')
})

test('compares aggregate changes with a previous manifest', () => {
  const current = snapshotOf(buildRunAuditManifest(result, context))
  const previous = parseAuditSnapshot(JSON.stringify(buildRunAuditManifest(result, {
    ...context, runId: 'run-previous',
  })))
  const comparison = compareAuditSnapshots(current, {
    ...previous, rows: 2, classifiedPct: 50, unresolvedClients: 1,
  })
  expect(comparison.sameSourceMetadata).toBe(true)
  expect(comparison.delta).toMatchObject({ rows: 1, unresolvedClients: -1 })
  expect(comparison.delta.classifiedPercentagePoints).toBeCloseTo(16.7)
})

test('rejects malformed and unsupported manifests before comparison', () => {
  expect(() => parseAuditSnapshot('{')).toThrow('JSON válido')
  expect(() => parseAuditSnapshot('{"schemaVersion":2}')).toThrow('no compatible')
  expect(() => parseAuditSnapshot('{"schemaVersion":1,"run":{}}')).toThrow('falta source')
})
