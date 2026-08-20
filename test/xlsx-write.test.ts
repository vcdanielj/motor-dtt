// @vitest-environment node
//
// Round-trip validation for the streaming XLSX writer that produces the standardized base.
// SheetJS acts as the strict, independent ZIP/OOXML reader (if it opens the file, Excel will);
// our own streamXlsxWorkbook validates that a re-uploaded standardized base ingests correctly.
import { describe, test, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { XlsxBaseWriter } from '@/reports/xlsx-write'
import { streamXlsxWorkbook, parseRowCells } from '@/ingest/xlsx-stream'

async function leerConSheetJS(blob: Blob): Promise<XLSX.WorkBook> {
  return XLSX.read(await blob.arrayBuffer(), { type: 'array' })
}

describe('XlsxBaseWriter — round-trip con SheetJS (lector independiente)', () => {
  test('escribe encabezado y filas con tipos correctos: números como número, códigos como texto', async () => {
    const writer = new XlsxBaseWriter(['RIF', 'CLIENTE', 'TON', 'COD'])
    writer.addRow(['J500522657', 'COMERCIAL LUCKY WUINY, C.A', '0.008928', '00125'])
    writer.addRow(['V12345678', 'ÁRBOL & CAFÉ <SUR>', '-0.38112', '218809'])
    writer.addRow(['', '', '', ''])
    const blob = await writer.finish()
    expect(blob.type).toContain('spreadsheetml')

    const wb = await leerConSheetJS(blob)
    expect(wb.SheetNames).toEqual(['Base'])
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Base, { header: 1, defval: null })
    expect(matriz[0]).toEqual(['RIF', 'CLIENTE', 'TON', 'COD'])
    // TON is a real number; the RIF keeps its letter; the leading-zero code stays TEXT.
    expect(matriz[1]).toEqual(['J500522657', 'COMERCIAL LUCKY WUINY, C.A', 0.008928, '00125'])
    // Accents, ampersands and angle brackets survive the XML escaping.
    expect(matriz[2]).toEqual(['V12345678', 'ÁRBOL & CAFÉ <SUR>', -0.38112, 218809])
  })

  test('las filas que superan el límite por hoja ruedan a "Base 2" con el encabezado repetido', async () => {
    // Tiny limit for the test: 3 rows per sheet (1 header + 2 data).
    const writer = new XlsxBaseWriter(['A', 'B'], { maxFilasPorHoja: 3 })
    for (let i = 1; i <= 5; i++) writer.addRow([`fila${i}`, String(i)])
    const blob = await writer.finish()

    const wb = await leerConSheetJS(blob)
    expect(wb.SheetNames).toEqual(['Base 1', 'Base 2', 'Base 3'])
    const hoja = (n: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1 })
    expect(hoja('Base 1')).toEqual([['A', 'B'], ['fila1', 1], ['fila2', 2]])
    expect(hoja('Base 2')).toEqual([['A', 'B'], ['fila3', 3], ['fila4', 4]])
    expect(hoja('Base 3')).toEqual([['A', 'B'], ['fila5', 5]])
  })

  test('sin CompressionStream cae a STORE y el archivo sigue siendo un XLSX válido', async () => {
    const original = (globalThis as { CompressionStream?: unknown }).CompressionStream
    vi.stubGlobal('CompressionStream', undefined)
    try {
      const writer = new XlsxBaseWriter(['X'])
      writer.addRow(['almacenado sin comprimir'])
      const blob = await writer.finish()
      const wb = await leerConSheetJS(blob)
      expect(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Base, { header: 1 })[1]).toEqual(['almacenado sin comprimir'])
    } finally {
      vi.stubGlobal('CompressionStream', original)
    }
  })
})

describe('XlsxBaseWriter — round-trip con la ingesta propia (re-subir la base estandarizada)', () => {
  test('el archivo exportado se puede volver a procesar: encabezados detectados y filas íntegras', async () => {
    const writer = new XlsxBaseWriter(['RIF', 'Canal/Tipo de Cliente', 'Estado', 'TON', 'segmento_n3_std'])
    writer.addRow(['J111', 'ABASTOS', 'ZULIA', '1.5', 'Abastos'])
    writer.addRow(['J222', 'BODEGAS', 'LARA', '2.25', 'Bodegas'])
    const blob = await writer.finish()

    const filas: Record<string, string>[] = []
    const res = await streamXlsxWorkbook(await blob.arrayBuffer(), () => {}, (rec) => filas.push(rec))

    expect(res.validSheets).toBe(1)
    expect(res.totalRows).toBe(2)
    expect(filas[0].RIF).toBe('J111')
    expect(filas[0]['Canal/Tipo de Cliente']).toBe('ABASTOS')
    expect(filas[0].TON).toBe('1.5')
    expect(filas[1].segmento_n3_std).toBe('Bodegas')
  })
})

describe('parseRowCells — celdas con y sin referencia r=', () => {
  test('celdas con r= respetan su posición (huecos incluidos)', () => {
    const xml = '<row r="2"><c r="A2"><v>1</v></c><c r="C2" t="s"><v>0</v></c></row>'
    expect(parseRowCells(xml, ['compartido'])).toEqual(['1', undefined, 'compartido'])
  })

  test('celdas sin r= avanzan secuencialmente, y <c/> vacías mantienen la alineación', () => {
    const xml = '<row><c t="inlineStr"><is><t>uno</t></is></c><c/><c><v>3</v></c></row>'
    expect(parseRowCells(xml, [])).toEqual(['uno', '', '3'])
  })

  test('mezcla: una celda con r= reancla el índice para las siguientes sin r=', () => {
    const xml = '<row><c><v>1</v></c><c r="D1"><v>4</v></c><c><v>5</v></c></row>'
    expect(parseRowCells(xml, [])).toEqual(['1', undefined, undefined, '4', '5'])
  })

  test('entidades XML decodificadas en inlineStr', () => {
    const xml = '<row><c t="inlineStr"><is><t>A &amp; B &lt;C&gt;</t></is></c></row>'
    expect(parseRowCells(xml, [])).toEqual(['A & B <C>'])
  })
})
