import { test, expect } from 'vitest'
import { detectSchema } from '@/ingest/schema-detect'

test('maps canonical Sell_out headers', () => {
  const m = detectSchema(['RIF', 'Canal/Tipo de Cliente', 'Estado', 'Ciudad', 'CAJAS', 'FECHA'])
  expect(m.rif).toBe('RIF')
  expect(m.segmentoCrudo).toBe('Canal/Tipo de Cliente')
  expect(m.estadoCrudo).toBe('Estado')
  expect(m.ciudad).toBe('Ciudad')
  expect(m.passthrough).toEqual(expect.arrayContaining(['CAJAS', 'FECHA']))
})

test('is accent- and case-insensitive on header aliases', () => {
  const m = detectSchema(['rif del cliente', 'TIPO DE NEGOCIO', 'edo.', 'MUNICIPIO'])
  expect(m.rif).toBe('rif del cliente')
  expect(m.segmentoCrudo).toBe('TIPO DE NEGOCIO')
  expect(m.estadoCrudo).toBe('edo.')
})

test('records unmapped headers', () => {
  const m = detectSchema(['RIF', 'COLUMNA_RARA'])
  expect(m.unmapped).toContain('COLUMNA_RARA')
  expect(m.segmentoCrudo).toBeNull()
})
