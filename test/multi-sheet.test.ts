import { describe, test, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { findBestHeaderRow } from '@/ingest/schema-detect'
import { isSummaryFooterRow } from '@/ingest/normalize'

describe('XLSX Multi-Sheet Ingestion Logic', () => {
  function makeWorkbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
    const wb = XLSX.utils.book_new()
    for (const [sheetName, aoa] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  }

  // Helper simulating streamXlsx from worker
  function streamXlsxTest(
    buf: ArrayBuffer,
    onRow: (rec: Record<string, string>, sheetName: string) => void,
  ): { validSheets: number; totalRows: number; sheetsFound: string[] } {
    const wb = XLSX.read(buf, { type: 'array' })
    let validSheets = 0
    let totalRows = 0
    const sheetsFound: string[] = []

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      if (!ws) continue
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
      if (!matrix.length) continue

      const bestHeader = findBestHeaderRow(matrix, 50)
      if (!bestHeader) continue

      const { headerRowIdx, headers, schema } = bestHeader
      validSheets++
      sheetsFound.push(name)

      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r]
        if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue
        const rec: Record<string, string> = {}
        for (let c = 0; c < headers.length; c++) {
          const key = headers[c]
          if (key) rec[key] = String(row[c] ?? '').trim()
        }
        if (isSummaryFooterRow(rec, schema.rif)) continue
        onRow(rec, name)
        totalRows++
      }
    }

    return { validSheets, totalRows, sheetsFound }
  }

  test('skips leading Pivot Table sheet and ingests data from second sheet ("BASE DE DATOS")', () => {
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
    const res = streamXlsxTest(buf, (rec) => rowsIngested.push(rec))

    expect(res.validSheets).toBe(1)
    expect(res.sheetsFound).toEqual(['BASE DE DATOS'])
    expect(res.totalRows).toBe(2)
    expect(rowsIngested[0].RIF).toBe('J123456789')
    expect(rowsIngested[0].DISTRIBUIDOR).toBe('SUMINISTROS FVR')
    expect(rowsIngested[1].RIF).toBe('J987654321')
  })

  test('ingests and combines multiple valid data sheets across months', () => {
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
    const res = streamXlsxTest(buf, (rec) => rowsIngested.push(rec))

    expect(res.validSheets).toBe(2)
    expect(res.sheetsFound).toEqual(['Octubre', 'Noviembre'])
    expect(res.totalRows).toBe(3)
    expect(rowsIngested.map((r) => r.RIF)).toEqual(['J111', 'J222', 'J333'])
  })

  test('handles letterhead, blank lines and footer totals smoothly', () => {
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
    const res = streamXlsxTest(buf, (rec) => rowsIngested.push(rec))

    expect(res.validSheets).toBe(1)
    expect(res.totalRows).toBe(2)
    expect(rowsIngested[0].RIF).toBe('J123456789')
    expect(rowsIngested[0]['Tipo de Tienda']).toBe('BODEGON')
    expect(rowsIngested[1].RIF).toBe('J987654321')
  })
})
