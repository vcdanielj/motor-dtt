/// <reference lib="webworker" />
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectSchema } from '@/ingest/schema-detect'
import { normalizeText } from '@/ingest/normalize'
import type { ProgressEvent, IngestSummary, FileKind } from '@/contracts/pipeline'

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

// A schema is usable if at least one core field (RIF / segment / state) was mapped.
const schemaIsUsable = (s: import('@/contracts/row').SchemaMap) =>
  s.rif !== null || s.segmentoCrudo !== null || s.estadoCrudo !== null

self.onmessage = async (ev: MessageEvent<{ file: File }>) => {
  const { file } = ev.data
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  let schema: import('@/contracts/row').SchemaMap | null = null
  let badSchema = false
  let rows = 0
  const owners = new Set<string>()
  const started = performance.now()
  // Incremental for CSV via PapaParse's cursor; XLSX is fully buffered (no cursor) so it stays at file.size.
  let bytesRead = file.size
  const bump = () => post({ type: 'progress', rows, distributors: owners.size, bytesRead })

  const onHeaders = (headers: string[]) => { schema = detectSchema(headers) }
  const onRow = (rec: Record<string, string>) => {
    rows++
    if (schema?.rif) { const v = normalizeText(rec[schema.rif] ?? ''); if (v) owners.add(v) }
    if (rows % 5000 === 0) bump()
  }

  try {
    if (kind === 'csv') {
      bytesRead = 0
      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true, skipEmptyLines: true, worker: false,
          step: (res, parser) => {
            if (!schema) {
              // Prefer PapaParse's authoritative field list; fall back to first row's keys.
              onHeaders(res.meta.fields ?? Object.keys(res.data))
              if (schema && !schemaIsUsable(schema)) { badSchema = true; parser.abort(); return }
            }
            if (typeof res.meta.cursor === 'number') bytesRead = res.meta.cursor
            onRow(res.data)
          },
          complete: () => resolve(),
          error: (err) => reject(err),
        })
      })
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      if (json.length) {
        onHeaders(Object.keys(json[0]))
        if (schema && !schemaIsUsable(schema)) badSchema = true
      }
      if (!badSchema) for (const rec of json) onRow(rec)
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (badSchema) return post({ type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' })
  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' })
  const finished = performance.now()
  const summary: IngestSummary = {
    fileName: file.name, fileKind: kind, totalRows: rows, distributors: owners.size,
    bytes: file.size, schema, headerRowCount: 1,
    startedAt: 0, finishedAt: 0, durationMs: Math.round(finished - started),
  }
  bytesRead = file.size
  bump()
  post({ type: 'done', summary })
}
