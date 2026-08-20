// Streaming XLSX writer for the standardized-base export. An 800K-row workbook cannot be built
// with ExcelJS/SheetJS in the browser — both materialize every cell as a JS object and would OOM
// exactly like the old string-based CSV export did. This module instead streams the sheet XML in
// small encoded chunks straight through a per-entry DEFLATE compressor (CompressionStream) into
// an in-memory ZIP whose payloads live as Blobs, which Chromium can page out to disk. Peak JS
// memory stays bounded by one flush buffer (~FLUSH_FILAS rows), never by the workbook size.
//
// No worker/DOM APIs beyond TextEncoder/Blob/CompressionStream — usable from the Web Worker and
// from Node-based tests alike (Node ≥18 ships all three).

/** Excel's hard row limit per sheet (header included). Data overflowing it rolls to "Base 2". */
export const XLSX_MAX_FILAS_POR_HOJA = 1_048_576

const FLUSH_FILAS = 2_000

// ── CRC-32 (incremental, table-based) ───────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32Update(crc: number, chunk: Uint8Array): number {
  let c = crc
  for (let i = 0; i < chunk.length; i++) c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8)
  return c >>> 0
}

// ── ZIP writer (sequential entries, assembled at finish) ────────────────────────────────────────

interface CompressionStreamCtor {
  new (format: string): { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }
}

function getDeflate(): CompressionStreamCtor | null {
  const ctor = (globalThis as { CompressionStream?: CompressionStreamCtor }).CompressionStream
  return typeof ctor === 'function' ? ctor : null
}

/** One zip entry being written. `write` is synchronous (chunks are chained into the compressor
 *  without awaiting — the producer is a sync parser callback); `close` awaits the full drain. */
class ZipEntryWriter {
  readonly path: string
  readonly method: 8 | 0
  crc = 0xffffffff
  uncompressedSize = 0
  compressedSize = 0
  /** Compressed payload. Folded into a Blob on close so the browser can page it out. */
  payload: Blob = new Blob([])
  private parts: Uint8Array[] = []
  private compressor: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> } | null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private pump: Promise<void> | null = null
  private chain: Promise<void> = Promise.resolve()

  constructor(path: string) {
    this.path = path
    const Deflate = getDeflate()
    this.compressor = Deflate ? new Deflate('deflate-raw') : null
    this.method = this.compressor ? 8 : 0
    if (this.compressor) {
      this.writer = this.compressor.writable.getWriter()
      const reader = this.compressor.readable.getReader()
      this.pump = (async () => {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          this.parts.push(value)
          this.compressedSize += value.length
        }
      })()
    }
  }

  write(chunk: Uint8Array): void {
    if (chunk.length === 0) return
    this.crc = crc32Update(this.crc, chunk)
    this.uncompressedSize += chunk.length
    if (this.writer) {
      const w = this.writer
      this.chain = this.chain.then(() => w.write(chunk))
    } else {
      this.parts.push(chunk)
      this.compressedSize += chunk.length
    }
  }

  async close(): Promise<void> {
    if (this.writer) {
      const w = this.writer
      await this.chain
      await w.close()
      await this.pump
    }
    this.crc = (this.crc ^ 0xffffffff) >>> 0
    if (this.uncompressedSize > 0xfffffffe || this.compressedSize > 0xfffffffe) {
      throw new Error('La hoja generada supera el límite ZIP de 4GB — exporta el archivo por partes')
    }
    this.payload = new Blob(this.parts as BlobPart[])
    this.parts = []
  }
}

function u16(v: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff])
}
function u32(v: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])
}
function concat(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) {
    out.set(a, off)
    off += a.length
  }
  return out
}

// Fixed DOS timestamp (1980-01-01 00:00) — workers avoid Date.now(), and a stable stamp keeps the
// output deterministic for a given input.
const DOS_TIME = u16(0)
const DOS_DATE = u16(0x0021)

/** Minimal sequential ZIP writer. Entries are written one after another and the archive is
 *  assembled at `finish()`, when every entry's crc/sizes are known — plain local headers, no data
 *  descriptors, maximum reader compatibility (Excel, LibreOffice, SheetJS, our own ingesta). */
class ZipWriter {
  private entries: ZipEntryWriter[] = []
  private encoder = new TextEncoder()

  open(path: string): ZipEntryWriter {
    const entry = new ZipEntryWriter(path)
    this.entries.push(entry)
    return entry
  }

  /** Convenience for the small metadata files: write whole content and close. */
  async addFile(path: string, content: string): Promise<void> {
    const entry = this.open(path)
    entry.write(this.encoder.encode(content))
    await entry.close()
  }

  finish(mimeType: string): Blob {
    const parts: BlobPart[] = []
    const central: Uint8Array[] = []
    let offset = 0

    for (const e of this.entries) {
      const name = this.encoder.encode(e.path)
      const local = concat(
        u32(0x04034b50), u16(20), u16(0), u16(e.method), DOS_TIME, DOS_DATE,
        u32(e.crc), u32(e.compressedSize), u32(e.uncompressedSize),
        u16(name.length), u16(0), name,
      )
      parts.push(local, e.payload)

      central.push(concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(e.method), DOS_TIME, DOS_DATE,
        u32(e.crc), u32(e.compressedSize), u32(e.uncompressedSize),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ))
      offset += local.length + e.compressedSize
    }

    const centralBytes = concat(...central)
    const eocd = concat(
      u32(0x06054b50), u16(0), u16(0), u16(this.entries.length), u16(this.entries.length),
      u32(centralBytes.length), u32(offset), u16(0),
    )
    parts.push(centralBytes, eocd)
    return new Blob(parts, { type: mimeType })
  }
}

// ── Sheet XML ───────────────────────────────────────────────────────────────────────────────────

// A cell comes out numeric only when Excel would keep it byte-identical: optional sign, no leading
// zeros (a '00125' client code must stay text), ≤15 significant digits (Excel's precision).
const NUMERICO = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,10})?$/

// Control characters that XML 1.0 forbids outright (tab/CR/LF are legal and kept).
// eslint-disable-next-line no-control-regex
const XML_INVALIDO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

function escapeXml(s: string): string {
  return s.replace(XML_INVALIDO, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function celdaXml(valor: string): string {
  if (valor === '') return '<c/>'
  if (valor.length <= 16 && NUMERICO.test(valor)) return `<c><v>${valor}</v></c>`
  return `<c t="inlineStr"><is><t>${escapeXml(valor)}</t></is></c>`
}

function filaXml(valores: string[]): string {
  let xml = '<row>'
  for (const v of valores) xml += celdaXml(v)
  return xml + '</row>'
}

const SHEET_PROLOGO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
const SHEET_EPILOGO = '</sheetData></worksheet>'

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
  '<borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
  '<cellXfs count="1"><xf xfId="0"/></cellXfs>' +
  '</styleSheet>'

/** Streams a headers-plus-rows table into a real XLSX workbook. `addRow` is synchronous (safe to
 *  call from the parser's row callbacks); rows past Excel's per-sheet limit roll over to a new
 *  sheet ("Base 2", "Base 3", …) with the header row repeated. */
export class XlsxBaseWriter {
  private zip = new ZipWriter()
  private encoder = new TextEncoder()
  private headerXml: string
  private hoja: ZipEntryWriter
  private hojas = 1
  private filasEnHoja = 1 // the header row
  private buffer: string[] = []
  private cierres: Promise<void>[] = []
  private readonly maxFilasPorHoja: number
  private readonly nombreBase: string

  constructor(headerValues: string[], opts?: { maxFilasPorHoja?: number; nombreBase?: string }) {
    this.maxFilasPorHoja = opts?.maxFilasPorHoja ?? XLSX_MAX_FILAS_POR_HOJA
    this.nombreBase = opts?.nombreBase ?? 'Base'
    this.headerXml = filaXml(headerValues)
    this.hoja = this.zip.open('xl/worksheets/sheet1.xml')
    this.buffer.push(SHEET_PROLOGO, this.headerXml)
  }

  addRow(valores: string[]): void {
    if (this.filasEnHoja >= this.maxFilasPorHoja) this.rolloverHoja()
    this.buffer.push(filaXml(valores))
    this.filasEnHoja++
    if (this.buffer.length >= FLUSH_FILAS) this.flush()
  }

  private flush(): void {
    if (this.buffer.length === 0) return
    this.hoja.write(this.encoder.encode(this.buffer.join('')))
    this.buffer = []
  }

  private rolloverHoja(): void {
    this.buffer.push(SHEET_EPILOGO)
    this.flush()
    this.cierres.push(this.hoja.close())
    this.hojas++
    this.hoja = this.zip.open(`xl/worksheets/sheet${this.hojas}.xml`)
    this.filasEnHoja = 1
    this.buffer.push(SHEET_PROLOGO, this.headerXml)
  }

  /** Closes the open sheet, writes the workbook metadata and assembles the final Blob. */
  async finish(): Promise<Blob> {
    this.buffer.push(SHEET_EPILOGO)
    this.flush()
    this.cierres.push(this.hoja.close())
    await Promise.all(this.cierres)

    const nums = Array.from({ length: this.hojas }, (_, i) => i + 1)

    await this.zip.addFile(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        nums.map((n) => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    )
    await this.zip.addFile(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    )
    await this.zip.addFile(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets>' +
        nums.map((n) => {
          const nombre = this.hojas === 1 ? this.nombreBase : `${this.nombreBase} ${n}`
          return `<sheet name="${escapeXml(nombre)}" sheetId="${n}" r:id="rId${n}"/>`
        }).join('') +
        '</sheets></workbook>',
    )
    await this.zip.addFile(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        nums.map((n) => `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`).join('') +
        `<Relationship Id="rId${this.hojas + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    )
    await this.zip.addFile('xl/styles.xml', STYLES_XML)

    return this.zip.finish(MIME_XLSX)
  }
}
