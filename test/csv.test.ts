import { test, expect, describe } from 'vitest'
import { csvCell, csvLine, csvDocument } from '@/reports/csv'

describe('csvCell', () => {
  test('plain values pass through unquoted', () => {
    expect(csvCell('ABASTOS')).toBe('ABASTOS')
  })

  test('empty string stays empty, unquoted', () => {
    expect(csvCell('')).toBe('')
  })

  test('quotes values containing a comma', () => {
    expect(csvCell('Bodega, Central')).toBe('"Bodega, Central"')
  })

  test('quotes and doubles internal double-quotes', () => {
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""')
  })

  test('quotes values containing a newline (LF)', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  test('quotes values containing a carriage return (CR)', () => {
    expect(csvCell('line1\rline2')).toBe('"line1\rline2"')
  })
})

describe('csvLine', () => {
  test('joins a mix of plain and special values, quoting only where needed', () => {
    expect(csvLine(['A', 'B,C', 'D"E', 'F'])).toBe('A,"B,C","D""E",F')
  })

  test('single-cell row', () => {
    expect(csvLine(['ONLY'])).toBe('ONLY')
  })

  test('empty row yields an empty string', () => {
    expect(csvLine([])).toBe('')
  })
})

describe('csvDocument', () => {
  test('joins header + rows with CRLF, no trailing newline', () => {
    const doc = csvDocument([
      ['variante', 'segmento_n3'],
      ['BODEGAS', 'BODEGA'],
      ['ABASTOS', 'ABASTO'],
    ])
    expect(doc).toBe('variante,segmento_n3\r\nBODEGAS,BODEGA\r\nABASTOS,ABASTO')
  })

  test('quotes cells within each row as csvLine would', () => {
    const doc = csvDocument([['a', 'b'], ['Bodega, Central', 'x']])
    expect(doc).toBe('a,b\r\n"Bodega, Central",x')
  })

  test('empty matrix yields an empty string', () => {
    expect(csvDocument([])).toBe('')
  })

  test('single row (header only)', () => {
    expect(csvDocument([['a', 'b']])).toBe('a,b')
  })
})
