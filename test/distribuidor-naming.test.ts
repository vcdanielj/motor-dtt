import { describe, it, expect } from 'vitest'
import { sanitizeDistributorFilename } from '@/reports/plantilla-clientes'
import { detectDistCol, detectClienteCol } from '@/ingest/schema-detect'

describe('Distributor Naming and Schema Detection', () => {
  it('generates clean, descriptive filenames with real distributor name instead of codes', () => {
    expect(sanitizeDistributorFilename('SUPLIMOS, C.A.')).toBe('Plantilla_Clientes_SUPLIMOS_C_A.xlsx')
    expect(sanitizeDistributorFilename('Alimentos Campesino S.A.')).toBe('Plantilla_Clientes_Alimentos_Campesino_S_A.xlsx')
    expect(sanitizeDistributorFilename('DISTRIBUIDOR DE OCCIDENTE')).toBe('Plantilla_Clientes_DISTRIBUIDOR_DE_OCCIDENTE.xlsx')
    expect(sanitizeDistributorFilename('DIS-00124')).toBe('Plantilla_Clientes_DIS-00124.xlsx')
    expect(sanitizeDistributorFilename('SIN_DISTRIBUIDOR')).toBe('Plantilla_Clientes_SIN_DISTRIBUIDOR.xlsx')
    expect(sanitizeDistributorFilename('')).toBe('Plantilla_Clientes_SIN_DISTRIBUIDOR.xlsx')
    expect(sanitizeDistributorFilename(null)).toBe('Plantilla_Clientes_SIN_DISTRIBUIDOR.xlsx')
  })

  it('detectDistCol strictly prioritizes textual distributor name column when code column is also present', () => {
    const headers = ['COD_DISTRIBUIDOR', 'NOMBRE_DISTRIBUIDOR', 'RIF_CLIENTE', 'VALOR_VENTA']
    const picked = detectDistCol(headers)
    expect(picked).toBe('NOMBRE_DISTRIBUIDOR')
  })

  it('detectClienteCol strictly prioritizes client name / razon social over code columns', () => {
    const headers = ['COD_CLIENTE', 'RAZON_SOCIAL_CLIENTE', 'RIF', 'ESTADO']
    const picked = detectClienteCol(headers)
    expect(picked).toBe('RAZON_SOCIAL_CLIENTE')
  })
})
