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

type ZipObjectWithStream = { internalStream(type: string): InternalStreamObject }

/** Streams a zip entry's text through `onChunk` without ever materializing the whole entry as one
 *  string — sharedStrings.xml alone can exceed V8's string length limit on massive workbooks. */
function streamZipEntry(
  zipObj: ZipObjectWithStream,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const decoder = new TextDecoder('utf-8')
    zipObj
      .internalStream('uint8array')
      .on('data', (chunk: Uint8Array) => onChunk(decoder.decode(chunk, { stream: true })))
      .on('end', () => resolve())
      .on('error', reject)
      .resume()
  })
}

const T_TAG_REGEX = /<t[^>]*>([^<]*)<\/t>/g

// Cell regex: the r= reference is OPTIONAL — our own streaming XLSX export (and other minimal
// writers) omit it, in which case cells advance sequentially, exactly as the OOXML spec allows.
const C_REGEX = /<c\b([^>]*)>(?:<is><t[^>]*>([^<]*)<\/t><\/is>)?(?:<v>([^<]*)<\/v>)?/g
const R_ATTR = /(?:^|\s)r="([A-Z]+)\d+"/
const T_ATTR = /(?:^|\s)t="([^"]*)"/

/** Parses one `<row>…</row>` XML fragment into positional cell values. Exported for tests. */
export function parseRowCells(rowXml: string, sharedStrings: string[]): string[] {
  const rowCells: string[] = []
  let nextIdx = 0
  C_REGEX.lastIndex = 0
  let cMatch: RegExpExecArray | null
  while ((cMatch = C_REGEX.exec(rowXml)) !== null) {
    const attrs = cMatch[1] ?? ''
    const rMatch = R_ATTR.exec(attrs)
    const colIndex = rMatch ? colToIdx(rMatch[1]) : nextIdx
    nextIdx = colIndex + 1
    const type = T_ATTR.exec(attrs)?.[1]
    const inlineText = cMatch[2]
    const val = cMatch[3]

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
  return rowCells
}

/** Parses xl/sharedStrings.xml chunk-by-chunk into the shared string table. */
async function parseSharedStrings(sstFile: ZipObjectWithStream): Promise<string[]> {
  const sharedStrings: string[] = []
  let buffer = ''
  await streamZipEntry(sstFile, (text) => {
    buffer += text
    let end: number
    while ((end = buffer.indexOf('</si>')) !== -1) {
      const block = buffer.slice(0, end)
      const tMatches = block.match(T_TAG_REGEX)
      if (tMatches) {
        const joined = tMatches.map((t) => t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, '')).join('')
        sharedStrings.push(decodeXmlEntities(joined))
      } else {
        sharedStrings.push('')
      }
      buffer = buffer.slice(end + 5)
    }
  })
  return sharedStrings
}

/** Streams all valid sheets of an XLSX workbook without exceeding V8 string length limits,
 *  supporting massive files (>1GB uncompressed) and skipping pivot tables/cover sheets.
 *
 *  `onSheetHeaders` returning false skips the REST of that sheet (its remaining rows are ignored);
 *  the stream then moves on to the next sheet. A sheet with no recognizable header row in its
 *  first MAX_SCAN_ROWS rows is likewise abandoned — before, such a sheet buffered every single
 *  row in memory, which is what froze the worker on workbooks with a giant cover/pivot sheet. */
export async function streamXlsxWorkbook(
  buf: ArrayBuffer,
  onSheetHeaders: (headers: string[], sheetName: string, schema: SchemaMap) => boolean | void,
  onRow: (rec: Record<string, string>, sheetName: string) => void,
): Promise<XlsxStreamResult> {
  const zip = await JSZip.loadAsync(buf)

  // 1. Parse sharedStrings.xml if present (streamed — never one giant string)
  const sstFile = zip.file('xl/sharedStrings.xml')
  const sharedStrings: string[] = sstFile
    ? await parseSharedStrings(sstFile as unknown as ZipObjectWithStream)
    : []

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
    // Sheet abandoned: header rejected by the caller, or no header in the scan window. Rows are
    // ignored from then on — the JSZip stream cannot be aborted, but parsing stops.
    let stopped = false
    let headers: string[] = []
    let schema: SchemaMap | null = null
    const matrixBuffer: string[][] = []
    const MAX_SCAN_ROWS = 50

    const flushBufferedRows = (fromIdx: number) => {
      for (let i = fromIdx; i < matrixBuffer.length; i++) {
        const bRow = matrixBuffer[i]
        const rec: Record<string, string> = {}
        for (let c = 0; c < headers.length; c++) {
          const k = headers[c]
          if (k) rec[k] = String(bRow[c] ?? '').trim()
        }
        if (schema && !isSummaryFooterRow(rec, schema.rif)) {
          onRow(rec, sheet.name)
          totalRows++
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      let chunkBuffer = ''
      const decoder = new TextDecoder('utf-8')

      // Use internalStream from JSZipObject to stream chunks without full-file string allocation
      const zipObj = sheetFile as unknown as ZipObjectWithStream
      zipObj
        .internalStream('uint8array')
        .on('data', (chunk: Uint8Array) => {
          if (stopped) return
          chunkBuffer += decoder.decode(chunk, { stream: true })

          let rowEndIdx: number
          while (!stopped && (rowEndIdx = chunkBuffer.indexOf('</row>')) !== -1) {
            const rowStartIdx = chunkBuffer.indexOf('<row')
            if (rowStartIdx !== -1 && rowStartIdx < rowEndIdx) {
              const rowXml = chunkBuffer.slice(rowStartIdx, rowEndIdx + 6)
              const rowCells = parseRowCells(rowXml, sharedStrings)

              if (!headerRowFound) {
                if (matrixBuffer.length >= MAX_SCAN_ROWS) {
                  // No recognizable header in the scan window: cover sheet, pivot, or notes.
                  // Abandon the sheet instead of buffering the rest of it in memory.
                  stopped = true
                  resolve()
                  return
                }
                matrixBuffer.push(rowCells.map((c) => String(c ?? '').trim()))
                const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
                if (best) {
                  headerRowFound = true
                  headers = best.headers
                  schema = best.schema
                  validSheets++
                  const accept = onSheetHeaders(headers, sheet.name, schema)
                  if (accept === false) {
                    stopped = true
                    resolve()
                    return
                  }
                  // Flush buffered rows after header row
                  flushBufferedRows(best.headerRowIdx + 1)
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
          if (!stopped && !headerRowFound && matrixBuffer.length > 0) {
            const best = findBestHeaderRow(matrixBuffer, MAX_SCAN_ROWS)
            if (best) {
              headerRowFound = true
              headers = best.headers
              schema = best.schema
              validSheets++
              const accept = onSheetHeaders(headers, sheet.name, schema)
              if (accept !== false) {
                flushBufferedRows(best.headerRowIdx + 1)
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
