import { describe, it, expect } from 'vitest'
import {
  detectSchema,
  detectDistCol,
  detectClienteCol,
  detectMesCol,
  detectTonCol,
  findBestHeaderRow,
} from '@/ingest/schema-detect'
import { parseNumeric, isSummaryFooterRow } from '@/ingest/normalize'
import { parseFechaOrden } from '@/pipeline/maestro'

describe('Robust Header & Schema Detection', () => {
  it('detects schema with dirty/varied column names', () => {
    const headers = [
      '  # NRO_DOCUMENTO_CLIENTE  ',
      'CATEGORÍA DE CLIENTE / SUB-CANAL',
      'EDO. DESTINO',
      'MUNICIPIO / LOCALIDAD',
      'NOMBRE DISTRIBUIDOR',
      'RAZÓN SOCIAL CLIENTE',
      'FECHA EMISIÓN',
      'VOLUMEN (TONELADAS)',
    ]
    const schema = detectSchema(headers)
    expect(schema.rif).toBe('  # NRO_DOCUMENTO_CLIENTE  ')
    expect(schema.segmentoCrudo).toBe('CATEGORÍA DE CLIENTE / SUB-CANAL')
    expect(schema.estadoCrudo).toBe('EDO. DESTINO')
    expect(schema.ciudad).toBe('MUNICIPIO / LOCALIDAD')

    expect(detectDistCol(headers)).toBe('NOMBRE DISTRIBUIDOR')
    expect(detectClienteCol(headers)).toBe('RAZÓN SOCIAL CLIENTE')
    expect(detectMesCol(headers)).toBe('FECHA EMISIÓN')
    expect(detectTonCol(headers)).toBe('VOLUMEN (TONELADAS)')
  })

  it('skips company letterhead (membrete) and picks true header row', () => {
    const matrix = [
      ['EMPRESA DISTRIBUIDORA DE ALIMENTOS C.A.'],
      ['RIF: J-12345678-9', 'TELEFONO: 0212-9999999'],
      ['REPORTE CONSOLIDADO SELL OUT HEINZ - OCTUBRE 2025 A MARZO 2026'],
      ['FECHA DE GENERACION: 16/08/2026', 'USUARIO: ADMIN'],
      [''],
      [
        'COD_DIST',
        'DISTRIBUIDOR',
        'RIF_CLIENTE',
        'NOMBRE_COMERCIAL',
        'TIPO_NEGOCIO',
        'ESTADO_ENTREGA',
        'CIUDAD_DESTINO',
        'MES_VENTA',
        'TOTAL_TON',
      ],
      ['D01', 'ALIMENTOS ANDINOS', 'J-30000001-1', 'SUPERMERCADO CENTRAL', 'SUPERMERCADO', 'MIRANDA', 'CARACAS', 'OCT-25', '12.5'],
      ['D01', 'ALIMENTOS ANDINOS', 'J-30000002-2', 'BODEGA EL SOL', 'BODEGA', 'ZULIA', 'MARACAIBO', 'OCT-25', '1.2'],
      ['TOTAL GENERAL', '', '', '', '', '', '', '', '13.7'],
    ]

    const best = findBestHeaderRow(matrix, 10)
    expect(best).not.toBeNull()
    expect(best!.headerRowIdx).toBe(5)
    expect(best!.schema.rif).toBe('RIF_CLIENTE')
    expect(best!.schema.segmentoCrudo).toBe('TIPO_NEGOCIO')
    expect(best!.schema.estadoCrudo).toBe('ESTADO_ENTREGA')
    expect(best!.schema.ciudad).toBe('CIUDAD_DESTINO')
  })
})

describe('Robust Numeric Parser (parseNumeric)', () => {
  it('parses Venezuelan / Latin comma decimal numbers', () => {
    expect(parseNumeric('1.234,56')).toBe(1234.56)
    expect(parseNumeric('12,50')).toBe(12.5)
    expect(parseNumeric('0,75')).toBe(0.75)
    expect(parseNumeric('1250,5')).toBe(1250.5)
  })

  it('parses US dot decimal numbers', () => {
    expect(parseNumeric('1,234.56')).toBe(1234.56)
    expect(parseNumeric('12.50')).toBe(12.5)
    expect(parseNumeric('0.75')).toBe(0.75)
  })

  it('handles currency, unit strings and negatives', () => {
    expect(parseNumeric('12.5 TON')).toBe(12.5)
    expect(parseNumeric('Bs. 1.500,00')).toBe(1500)
    expect(parseNumeric('$ 2,500.75 USD')).toBe(2500.75)
    expect(parseNumeric('-45.8')).toBe(-45.8)
    expect(parseNumeric('(120.50)')).toBe(-120.5)
    expect(parseNumeric('')).toBe(0)
    expect(parseNumeric(null)).toBe(0)
  })
})

describe('Robust Date Parser (parseFechaOrden)', () => {
  it('parses text months and dates across multiple formats', () => {
    expect(parseFechaOrden('OCT-25')).toBe(202510)
    expect(parseFechaOrden('Oct/25')).toBe(202510)
    expect(parseFechaOrden('Octubre 2025')).toBe(202510)
    expect(parseFechaOrden('OCTOBER 2025')).toBe(202510)
    expect(parseFechaOrden('ENE-2026')).toBe(202601)
    expect(parseFechaOrden('2025-10-15')).toBe(202510)
    expect(parseFechaOrden('15/10/2025')).toBe(202510)
    expect(parseFechaOrden('10/2025')).toBe(202510)
    expect(parseFechaOrden('2025/10')).toBe(202510)
  })

  it('parses Excel serial date numbers', () => {
    // 45946 -> October 15, 2025
    expect(parseFechaOrden(45946)).toBe(202510)
  })
})

describe('Summary Footer Detection (isSummaryFooterRow)', () => {
  it('detects footer summary rows', () => {
    expect(isSummaryFooterRow({ RIF: 'TOTAL GENERAL', TON: '125.4' }, 'RIF')).toBe(true)
    expect(isSummaryFooterRow({ RIF: 'TOTAL', TON: '50' }, 'RIF')).toBe(true)
    expect(isSummaryFooterRow({ RIF: 'SUMATORIA', CLIENTE: '' }, 'RIF')).toBe(true)
    expect(isSummaryFooterRow({ RIF: 'J-30000001-1', TON: '12.5' }, 'RIF')).toBe(false)
  })
})
