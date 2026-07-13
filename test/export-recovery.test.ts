import { test, expect, describe } from 'vitest'
import { SEEDS } from '@/seeds'
import { buildIndex, type SegmentoContext } from '@/pipeline/segmento'
import { buildEstadoContext } from '@/pipeline/estado'
import { MaestroBuilder } from '@/pipeline/maestro'
import { detectSchema } from '@/ingest/schema-detect'
import { OUTPUT_COLUMNS } from '@/contracts/row'
import {
  detectExportExtraCols,
  observeExportRow,
  exportRowLine,
  exportHeaderLine,
} from '@/reports/export-base'

// Drives the export helpers exactly as the worker's two internal passes do — Pass A observes
// every row into a MaestroBuilder (seeds only), Pass B resolves each row WITH the FULL built
// maestro — then parses the produced CSV line. This is the property the Critical bug broke:
// recovered RIFs must come out MAESTRO, for ALL clients, never capped at the 500-row view array.
function runExportOverRows(headers: string[], rows: Record<string, string>[], version: string, runId: string) {
  const index = buildIndex(SEEDS.diccionario)
  const est = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)
  const schema = detectSchema(headers)
  const cols = detectExportExtraCols(headers)

  // Pass A — build full maestro.
  const segSeed: SegmentoContext = { index, maestro: new Map(), fuzzyThreshold: 92, fuzzySuggestFloor: 80 }
  const builder = new MaestroBuilder()
  for (const rec of rows) observeExportRow(builder, rec, schema, cols, segSeed)
  const { maestro } = builder.build()

  // Pass B — write with the full maestro applied.
  const seg: SegmentoContext = { index, maestro, fuzzyThreshold: 92, fuzzySuggestFloor: 80 }
  const lines = [exportHeaderLine(headers), ...rows.map((rec) => exportRowLine(rec, headers, schema, seg, est, version, runId))]
  return { lines, maestroSize: maestro.size }
}

// Parse one CSV data line (fixture values are comma/quote-free) into a header->value map.
function parseLine(headers: string[], line: string): Record<string, string> {
  const cells = line.split(',')
  const all = [...headers, ...OUTPUT_COLUMNS]
  return Object.fromEntries(all.map((h, i) => [h, cells[i]]))
}

describe('export recovery — full maestro applied, uncapped', () => {
  test('a RIF classified in one row recovers an empty-segment row for the same RIF as MAESTRO', () => {
    const headers = ['RIF', 'CANAL', 'EDO']
    const rows = [
      { RIF: 'J-1', CANAL: 'Bodegas', EDO: 'Zulia' }, // classifies EXACTO -> feeds maestro
      { RIF: 'J-1', CANAL: '', EDO: 'Zulia' }, // empty crudo -> only recoverable via maestro
    ]
    const { lines } = runExportOverRows(headers, rows, 'v1', 'run-1')

    const recovered = parseLine(headers, lines[2]) // second data row
    expect(recovered.segmento_n3_std).toBe('BODEGA')
    expect(recovered.metodo_segmento).toBe('MAESTRO')
    expect(recovered.flag_registro).toBe('OK')
    expect(recovered.run_id).toBe('run-1')
    expect(recovered.version_diccionario).toBe('v1')
  })

  test('recovery is NOT capped at 500: the 600th distinct RIF still recovers as MAESTRO', () => {
    const headers = ['RIF', 'CANAL', 'EDO']
    const rows: Record<string, string>[] = []
    // 600 distinct classified RIFs (would overflow any 500-row view cap), then an empty-segment
    // row for the 600th — only the FULL maestro can recover it.
    for (let i = 1; i <= 600; i++) rows.push({ RIF: `J-${i}`, CANAL: 'Bodegas', EDO: 'Zulia' })
    rows.push({ RIF: 'J-600', CANAL: '', EDO: 'Zulia' })

    const { lines, maestroSize } = runExportOverRows(headers, rows, 'v1', 'run-1')
    expect(maestroSize).toBe(600)

    const recovered = parseLine(headers, lines[lines.length - 1]) // the trailing empty-segment row
    expect(recovered.RIF).toBe('J-600')
    expect(recovered.segmento_n3_std).toBe('BODEGA')
    expect(recovered.metodo_segmento).toBe('MAESTRO')
  })

  test('control: without the maestro (empty-segment row, no prior classification) the same row is SIN_CLASIFICAR', () => {
    const headers = ['RIF', 'CANAL', 'EDO']
    const rows = [{ RIF: 'J-99', CANAL: '', EDO: 'Zulia' }] // never classified anywhere
    const { lines } = runExportOverRows(headers, rows, 'v1', 'run-1')

    const row = parseLine(headers, lines[1])
    expect(row.segmento_n3_std).toBe('')
    expect(row.metodo_segmento).toBe('')
    expect(row.flag_registro).toBe('SIN_CLASIFICAR')
  })
})
