import JSZip from 'jszip'
import { findBestHeaderRow } from '@/ingest/schema-detect'
import { isSummaryFooterRow } from '@/ingest/normalize'
import type { SchemaMap } from '@/contracts/row'

function colToIdx(colStr: string): number {
  let idx = 0
  for (let i = 0; i < colStr.length; i++) {
    idx = idx * 26 + (colStr.charCodeAt(i) - 64)
  }
  return idx - 1
}

function decodeXmlEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export interface XlsxStreamResult {
  validSheets: number
  totalRows: number
}

interface InternalStreamObject {
  on(event: 'data', callback: (chunk: Uint8Array) => void): InternalStreamObject
  on(event: 'end', callback: () => void): InternalStreamObject
  on(event: 'error', callback: (err: unknown) => void): InternalStreamObject
  resume(): InternalStreamObject
}

/** Streams all valid sheets of an XLSX workbook without exceeding V8 string length limits,
 *  supporting massive files (>1GB uncompressed) and skipping pivot tables/cover sheets. */
export async function streamXlsxWorkbook(
  buf: ArrayBuffer,
  onSheetHeaders: (headers: string[], sheetName: string, schema: SchemaMap) => boolean | void,
  onRow: (rec: Record<string, string>, sheetName: string) => void,
): Promise<XlsxStreamResult> {
  const zip = await JSZip.loadAsync(buf)

  // 1. Parse sharedStrings.xml if present
  const sharedStrings: string[] = []
  const sstFile = zip.file('xl/sharedStrings.xml')
  if (sstFile) {
    const sstXml = await sstFile.async('string')
    const siBlocks = sstXml.split('</si>')
    for (let i = 0; i < siBlocks.length - 1; i++) {
      const block = siBlocks[i]
      const tMatches = block.match(/<t[^>]*>([^<]*)<\/t>/g)
      if (tMatches) {
        const text = tMatches.map((t) => t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, '')).join('')
        sharedStrings.push(decodeXmlEntities(text))
      } else {
        sharedStrings.push('')
      }
    }
  }

  // 2. Discover sheets and paths
  const wbFile = zip.file('xl/workbook.xml')
  const relsFile = zip.file('xl/_rels/workbook.xml.rels')

  const sheetEntries: { name: string; path: string }[] = []
  if (wbFile && relsFile) {
    const wbXml = await wbFile.async('string')
    const relsXml = await relsFile.async('string')

    const sheetMatches = wbXml.matchAll(/<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)
    const relsMap = new Map<string, string>()
    for (const m of relsXml.matchAll(/<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      relsMap.set(m[1], m[2].replace(/^\//, '').replace(/^xl\//, ''))
    }

    for (const m of sheetMatches) {
      const name = decodeXmlEntities(m[1])
      const rId = m[2]
      const target = relsMap.get(rId)
      if (target) {
        sheetEntries.push({ name, path: `xl/${target}` })
      }
    }
  } else {
    // Fallback if workbook.xml is missing: look for sheet*.xml
    for (const fileName of Object.keys(zip.files)) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(fileName)) {
        sheetEntries.push({ name: fileName.replace(/^xl\/worksheets\//, '').replace(/\.xml$/, ''), path: fileName })
      }
    }
  }

  let validSheets = 0
  let totalRows = 0

  for (const sheet of sheetEntries) {
    const sheetFile = zip.file(sheet.path)
    if (!sheetFile) continue

    let headerRowFound = false
    let headers: string[] = []
    let schema: SchemaMap | null = null
    const matrixBuffer: string[][] = []
    const MAX_SCAN_ROWS = 50

    await new Promise<void>((resolve, reject) => {
      let chunkBuffer = ''
      const decoder = new TextDecoder('utf-8')

      // Use internalStream from JSZipObject to stream chunks without full-file string allocation
      const zipObj = sheetFile as unknown as { internalStream(type: string): InternalStreamObject }
      zipObj
        .internalStream('uint8array')
        .on('data', (chunk: Uint8Array) => {
          chunkBuffer += decoder.decode(chunk, { stream: true })

          let rowEndIdx: number
          while ((rowEndIdx = chunkBuffer.indexOf('</row>')) !== -1) {
            const rowStartIdx = chunkBuffer.indexOf('<row')
            if (rowStartIdx !== -1 && rowStartIdx < rowEndIdx) {
              const rowXml = chunkBuffer.slice(rowStartIdx, rowEndIdx + 6)

              const rowCells: string[] = []
              const cRegex = /<c\s+r="([A-Z]+)\d+"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<is><t>([^<]*)<\/t><\/is>)?(?:<v>([^<]*)<\/v>)?/g
              let cMatch: RegExpExecArray | null
              while ((cMatch = cRegex.exec(rowXml)) !== null) {
                const colLetters = cMatch[1]
                const colIndex = colToIdx(colLetters)
                const type = cMatch[2]
                const inlineText = cMatch[3]
                const val = cMatch[4]

                let cellValue = ''
                if (inlineText !== undefined) {
                  cellValue = decodeXmlEntities(inlineText)
                } else if (type === 's' && val !== undefined) {
                  const idx = parseInt(val, 10)
                  cellValue = sharedStrings[idx] ?? ''
                } else if (val !== undefined) {
                  cellValue = decodeXmlEntities(val)
                }
                rowCells[colIndex] = cellValue
              }

              if (!headerRowFound) {
                matrixBuffer.push(rowCells.map((c) => String(c ?? '').trim()))
                if (matrixBuffer.length <= MAX_SCAN_ROWS) {
                  const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
                  if (best) {
                    headerRowFound = true
                    headers = best.headers
                    schema = best.schema
                    validSheets++
                    const accept = onSheetHeaders(headers, sheet.name, schema)
                    if (accept === false) {
                      resolve()
                      return
                    }
                    // Flush buffered rows after header row
                    for (let i = best.headerRowIdx + 1; i < matrixBuffer.length; i++) {
                      const bRow = matrixBuffer[i]
                      const rec: Record<string, string> = {}
                      for (let c = 0; c < headers.length; c++) {
                        const k = headers[c]
                        if (k) rec[k] = String(bRow[c] ?? '').trim()
                      }
                      if (!isSummaryFooterRow(rec, schema.rif)) {
                        onRow(rec, sheet.name)
                        totalRows++
                      }
                    }
                  }
                }
              } else {
                // Streaming data row
                const rec: Record<string, string> = {}
                for (let c = 0; c < headers.length; c++) {
                  const k = headers[c]
                  if (k) rec[k] = String(rowCells[c] ?? '').trim()
                }
                if (schema && !isSummaryFooterRow(rec, schema.rif)) {
                  onRow(rec, sheet.name)
                  totalRows++
                }
              }
            }
            chunkBuffer = chunkBuffer.slice(rowEndIdx + 6)
          }
        })
        .on('end', () => {
          if (!headerRowFound && matrixBuffer.length > 0) {
            const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
            if (best) {
              headerRowFound = true
              headers = best.headers
              schema = best.schema
              validSheets++
              onSheetHeaders(headers, sheet.name, schema)
              for (let i = best.headerRowIdx + 1; i < matrixBuffer.length; i++) {
                const bRow = matrixBuffer[i]
                const rec: Record<string, string> = {}
                for (let c = 0; c < headers.length; c++) {
                  const k = headers[c]
                  if (k) rec[k] = String(bRow[c] ?? '').trim()
                }
                if (!isSummaryFooterRow(rec, schema.rif)) {
                  onRow(rec, sheet.name)
                  totalRows++
                }
              }
            }
          }
          resolve()
        })
        .on('error', reject)
        .resume()
    })
  }

  return { validSheets, totalRows }
}
