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

test('strips diacritics on accented headers', () => {
  // Genuinely accented vowels — exercises the NFD diacritic-strip path.
  const m = detectSchema(['Canal/Tipo de Cliénte', 'Estádo', 'Ciudád'])
  expect(m.segmentoCrudo).toBe('Canal/Tipo de Cliénte')
  expect(m.estadoCrudo).toBe('Estádo')
  expect(m.ciudad).toBe('Ciudád')
})

test('records unmapped headers', () => {
  const m = detectSchema(['RIF', 'COLUMNA_RARA'])
  expect(m.unmapped).toContain('COLUMNA_RARA')
  expect(m.segmentoCrudo).toBeNull()
})

test('real Sell_out header row: does NOT mis-map estado to "VENDEDOR HEINZ"', () => {
  // Regression: the short needle 'EDO' used to substring-match inside "vENDEDOr".
  // The real file has both "VENDEDOR HEINZ" and "Estado" columns.
  const real = [
    'MES', 'COD. DIST', 'Dir. de Entrega', 'DISTRIBUIDOR  ', 'VENDEDOR HEINZ',
    'Código Vendedor', 'Nombre Vendedor', 'Código Cliente', 'CLIENTE', 'RIF',
    'Canal/Tipo de Cliente', 'Ciudad', 'Municipio', 'Estado', 'FECHA', 'CAJAS', 'TON', 'UNIDADES',
  ]
  const m = detectSchema(real)
  expect(m.rif).toBe('RIF')
  expect(m.segmentoCrudo).toBe('Canal/Tipo de Cliente')
  expect(m.estadoCrudo).toBe('Estado') // NOT 'VENDEDOR HEINZ'
  expect(m.ciudad).toBe('Ciudad')
  expect(m.passthrough).toEqual(expect.arrayContaining(['CAJAS', 'TON', 'UNIDADES', 'FECHA']))
})

test('a status column that merely contains the word ESTADO does not shadow the real one', () => {
  // Regression: 'ESTADO DEL PEDIDO' matched the ESTADO needle and, since the first match per
  // field wins, the actual 'Estado' column was never mapped — every row came out SIN_ESTADO.
  const m = detectSchema(['RIF', 'Estado del Pedido', 'Canal', 'Estado', 'Ciudad'])
  expect(m.estadoCrudo).toBe('Estado')
  expect(m.unmapped).toContain('Estado del Pedido')
})

test.each(['Estado Civil', 'Estado del Cliente', 'Estatus', 'Estado de Cuenta'])(
  '%s is not treated as the state column',
  (header) => {
    expect(detectSchema(['RIF', header]).estadoCrudo).toBeNull()
  },
)

test('ciudad also maps MUNICIPIO, LOCALIDAD and PARROQUIA when no CIUDAD column exists', () => {
  expect(detectSchema(['RIF', 'Municipio']).ciudad).toBe('Municipio')
  expect(detectSchema(['RIF', 'Localidad']).ciudad).toBe('Localidad')
  expect(detectSchema(['RIF', 'Parroquia']).ciudad).toBe('Parroquia')
})

test('segmento also maps GIRO, RUBRO and SUBCANAL', () => {
  expect(detectSchema(['RIF', 'Giro']).segmentoCrudo).toBe('Giro')
  expect(detectSchema(['RIF', 'Rubro']).segmentoCrudo).toBe('Rubro')
  expect(detectSchema(['RIF', 'Subcanal']).segmentoCrudo).toBe('Subcanal')
})
