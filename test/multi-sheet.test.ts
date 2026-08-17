import { describe, test, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { streamXlsxWorkbook } from '@/ingest/xlsx-stream'

describe('XLSX Multi-Sheet Ingestion Logic', () => {
  function makeWorkbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
    const wb = XLSX.utils.book_new()
    for (const [sheetName, aoa] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  }

  test('skips leading Pivot Table sheet and ingests data from second sheet ("BASE DE DATOS")', async () => {
    const pivotSheet = [
      ['', ''],
      ['Distinct Count of RIF', 'Column Labels', 'Total'],
      ['Row Labels', 'Oct-25', 'Nov-25'],
      ['DISTRIBUIDOR A', 10, 20],
    ]

    const dataSheet = [
      ['MES', 'COD. DIST', 'DISTRIBUIDOR', 'CLIENTE', 'RIF', 'Canal/Tipo de Cliente', 'Estado', 'TON'],
      ['10/2025', '208692', 'SUMINISTROS FVR', 'FRUTERIA EL SOL', 'J123456789', 'ABASTO', 'MIRANDA', '1.5'],
      ['10/2025', '208692', 'SUMINISTROS FVR', 'PANADERIA LA ESPIGA', 'J987654321', 'PANADERIA', 'CARABOBO', '2.0'],
    ]

    const buf = makeWorkbookBuffer({
      Sheet4_Pivot: pivotSheet,
      'BASE DE DATOS': dataSheet,
    })

    const rowsIngested: Record<string, string>[] = []
    const sheetsFound: string[] = []
    const res = await streamXlsxWorkbook(
      buf,
      (_, sheetName) => {
        sheetsFound.push(sheetName)
      },
      (rec) => {
        rowsIngested.push(rec)
      },
    )

    expect(res.validSheets).toBe(1)
    expect(sheetsFound).toEqual(['BASE DE DATOS'])
    expect(res.totalRows).toBe(2)
    expect(rowsIngested[0].RIF).toBe('J123456789')
    expect(rowsIngested[0].DISTRIBUIDOR).toBe('SUMINISTROS FVR')
    expect(rowsIngested[1].RIF).toBe('J987654321')
  })

  test('ingests and combines multiple valid data sheets across months', async () => {
    const headers = ['MES', 'DISTRIBUIDOR', 'CLIENTE', 'RIF', 'Canal', 'Estado', 'TON']
    const sheetOct = [
      headers,
      ['10/2025', 'DIST A', 'CLIENTE 1', 'J111', 'ABASTO', 'ZULIA', '1.0'],
      ['10/2025', 'DIST A', 'CLIENTE 2', 'J222', 'FARMACIA', 'LARA', '2.0'],
    ]
    const sheetNov = [
      headers,
      ['11/2025', 'DIST A', 'CLIENTE 3', 'J333', 'PANADERIA', 'ARAGUA', '3.0'],
    ]
    const summarySheet = [
      ['RESUMEN EJECUTIVO'],
      ['Total Ventas', '1000'],
    ]

    const buf = makeWorkbookBuffer({
      Octubre: sheetOct,
      Noviembre: sheetNov,
      Resumen: summarySheet,
    })

    const rowsIngested: Record<string, string>[] = []
    const sheetsFound: string[] = []
    const res = await streamXlsxWorkbook(
      buf,
      (_, sheetName) => {
        sheetsFound.push(sheetName)
      },
      (rec) => {
        rowsIngested.push(rec)
      },
    )

    expect(res.validSheets).toBe(2)
    expect(sheetsFound).toEqual(['Octubre', 'Noviembre'])
    expect(res.totalRows).toBe(3)
    expect(rowsIngested.map((r) => r.RIF)).toEqual(['J111', 'J222', 'J333'])
  })

  test('handles letterhead, blank lines and footer totals smoothly', async () => {
    const styledSheet = [
      ['DISTRIBUIDORA NACIONAL C.A.'],
      ['RIF J-12345678-0 - REPORTE DE VENTAS'],
      [''],
      [''],
      ['DISTRIBUIDOR', 'RIF', 'CLIENTE', 'Tipo de Tienda', 'Estado', 'TON'],
      ['SUMINISTROS FVR', 'J123456789', 'BODEGON REAL', 'BODEGON', 'DISTRITO CAPITAL', '4.2'],
      ['SUMINISTROS FVR', 'J987654321', 'SUPERMERCADO REAL', 'SUPERMERCADO', 'MIRANDA', '10.5'],
      ['TOTAL GENERAL', '', '', '', '', '14.7'],
    ]

    const buf = makeWorkbookBuffer({
      DataConTitulo: styledSheet,
    })

    const rowsIngested: Record<string, string>[] = []
    const res = await streamXlsxWorkbook(
      buf,
      () => {},
      (rec) => rowsIngested.push(rec),
    )

    expect(res.validSheets).toBe(1)
    expect(res.totalRows).toBe(2)
    expect(rowsIngested[0].RIF).toBe('J123456789')
    expect(rowsIngested[0]['Tipo de Tienda']).toBe('BODEGON')
    expect(rowsIngested[1].RIF).toBe('J987654321')
  })
})
