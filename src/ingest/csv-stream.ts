import Papa from 'papaparse'
import { findBestHeaderRow } from './schema-detect'
import { isSummaryFooterRow } from './normalize'
import type { SchemaMap } from '@/contracts/row'

// Streams CSV records handling leading letterheads (membretes) and blank lines before headers.
export async function streamCsv(
  file: File,
  onHeaders: (headers: string[], schema: SchemaMap) => boolean | void,
  onRow: (rec: Record<string, string>) => void,
  onProgress?: (bytesRead: number) => void,
): Promise<{ ok: boolean; totalRows: number }> {
  let headerRowFound = false
  let headers: string[] = []
  let schema: SchemaMap | null = null
  let totalRows = 0
  const matrixBuffer: string[][] = []
  const MAX_SCAN_ROWS = 50

  return new Promise<{ ok: boolean; totalRows: number }>((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      worker: false,
      step: (res, parser) => {
        if (typeof res.meta.cursor === 'number' && onProgress) {
          onProgress(res.meta.cursor)
        }

        const row = res.data
        if (!row || !row.some((c) => String(c ?? '').trim() !== '')) return

        if (!headerRowFound) {
          matrixBuffer.push(row.map((c) => String(c ?? '').trim()))
          if (matrixBuffer.length <= MAX_SCAN_ROWS) {
            const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
            if (best) {
              headerRowFound = true
              headers = best.headers
              schema = best.schema
              const accept = onHeaders(headers, schema)
              if (accept === false) {
                parser.abort()
                resolve({ ok: false, totalRows: 0 })
                return
              }
              // Process buffered data rows after the header row
              for (let i = best.headerRowIdx + 1; i < matrixBuffer.length; i++) {
                const bRow = matrixBuffer[i]
                const rec: Record<string, string> = {}
                for (let c = 0; c < headers.length; c++) {
                  const k = headers[c]
                  if (k) rec[k] = String(bRow[c] ?? '').trim()
                }
                if (!isSummaryFooterRow(rec, schema.rif)) {
                  onRow(rec)
                  totalRows++
                }
              }
            }
          }
        } else {
          // Normal data row streaming
          const rec: Record<string, string> = {}
          for (let c = 0; c < headers.length; c++) {
            const k = headers[c]
            if (k) rec[k] = String(row[c] ?? '').trim()
          }
          if (schema && !isSummaryFooterRow(rec, schema.rif)) {
            onRow(rec)
            totalRows++
          }
        }
      },
      complete: () => {
        if (!headerRowFound && matrixBuffer.length > 0) {
          const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
          if (best) {
            headers = best.headers
            schema = best.schema
            onHeaders(headers, schema)
            for (let i = best.headerRowIdx + 1; i < matrixBuffer.length; i++) {
              const bRow = matrixBuffer[i]
              const rec: Record<string, string> = {}
              for (let c = 0; c < headers.length; c++) {
                const k = headers[c]
                if (k) rec[k] = String(bRow[c] ?? '').trim()
              }
              if (!isSummaryFooterRow(rec, schema.rif)) {
                onRow(rec)
                totalRows++
              }
            }
          }
        }
        resolve({ ok: headerRowFound && totalRows > 0, totalRows })
      },
      error: (err) => reject(err),
    })
  })
}
