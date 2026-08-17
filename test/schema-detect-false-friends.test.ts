import { test, expect, describe } from 'vitest'
import {
  detectSchema,
  schemaIsUsable,
  isDataSheetSchema,
  detectDistCol,
  detectClienteCol,
  detectMesCol,
  detectTonCol,
} from '@/ingest/schema-detect'

describe('schema-detect — false friends and column detection', () => {
  test('ignores pivot table aggregate RIF columns as false friends', () => {
    const pivotHeaders = ['Distinct Count of RIF', 'Column Labels', 'Row Labels', 'Grand Total']
    const schema = detectSchema(pivotHeaders)
    expect(schema.rif).toBeNull()
    expect(schemaIsUsable(schema)).toBe(false)
    expect(isDataSheetSchema(schema)).toBe(false)
  })

  test.each([
    'Distinct Count of RIF',
    'Count of RIF',
    'Sum of RIF',
    'Total RIF',
    'Conteo de RIF',
    'Cantidad de RIF',
    'Recuento de RIF',
  ])('discards "%s" from matching rif field', (header) => {
    const schema = detectSchema([header, 'Canal', 'Estado'])
    expect(schema.rif).toBeNull()
  })

  test('prioritizes textual distributor name over distributor code', () => {
    const realHeaders = [
      'MES',
      'COD. DIST',
      'Dir. de Entrega',
      'DISTRIBUIDOR  ',
      'VENDEDOR HEINZ',
      'Código Vendedor',
      'Nombre Vendedor',
      'Código Cliente',
      'CLIENTE',
      'RIF',
      'Canal/Tipo de Cliente',
      'Ciudad',
      'Municipio',
      'Estado',
    ]
    expect(detectDistCol(realHeaders)).toBe('DISTRIBUIDOR  ')
  })

  test('prioritizes client business name over client code', () => {
    const realHeaders = [
      'MES',
      'COD. DIST',
      'Dir. de Entrega',
      'DISTRIBUIDOR  ',
      'Código Cliente',
      'CLIENTE',
      'RIF',
    ]
    expect(detectClienteCol(realHeaders)).toBe('CLIENTE')
  })

  test('detects RAZON SOCIAL and NOMBRE CLIENTE as client column', () => {
    expect(detectClienteCol(['Código Cliente', 'Razón Social', 'RIF'])).toBe('Razón Social')
    expect(detectClienteCol(['COD_CLI', 'NOMBRE DEL CLIENTE', 'RIF'])).toBe('NOMBRE DEL CLIENTE')
  })

  test('detects MES, PERIODO and FECHA columns', () => {
    expect(detectMesCol(['MES', 'COD'])).toBe('MES')
    expect(detectMesCol(['Periodo Fiscal', 'COD'])).toBe('Periodo Fiscal')
    expect(detectMesCol(['FECHA_DOCUMENTO', 'COD'])).toBe('FECHA_DOCUMENTO')
  })

  test('detects TON, TONELADAS columns', () => {
    expect(detectTonCol(['TON', 'CAJAS'])).toBe('TON')
    expect(detectTonCol(['Toneladas Facturadas', 'CAJAS'])).toBe('Toneladas Facturadas')
  })
})
