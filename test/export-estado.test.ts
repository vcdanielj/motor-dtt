import { test, expect, describe } from 'vitest'
import { SEEDS } from '@/seeds'
import { buildIndex, type SegmentoContext } from '@/pipeline/segmento'
import { buildEstadoContext } from '@/pipeline/estado'
import { MaestroBuilder } from '@/pipeline/maestro'
import { detectSchema } from '@/ingest/schema-detect'
import { OUTPUT_COLUMNS } from '@/contracts/row'
import {
  detectExportExtraCols, observeExportRow, exportRowLine, exportHeaderLine,
} from '@/reports/export-base'
import type { MaestroEntry } from '@/contracts/maestro'

/** Drives the export helpers exactly as the worker's two internal passes do, now with the estado
 *  context wired through both — Pass A observes states into the maestro, Pass B resolves with the
 *  finished estadoByRif map applied. */
function runExport(
  headers: string[],
  rows: Record<string, string>[],
  manualMaestro: MaestroEntry[] = [],
) {
  const index = buildIndex(SEEDS.diccionario)
  const estSeed = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado, new Map(), SEEDS.estadoDiccionario)
  const schema = detectSchema(headers)
  const cols = detectExportExtraCols(headers)

  const segSeed: SegmentoContext = { index, maestro: new Map(), fuzzyThreshold: 92, fuzzySuggestFloor: 80 }
  const builder = new MaestroBuilder()
  for (const m of manualMaestro) {
    builder.observe({
      rif: m.rif, segmentoN3: m.segmentoN3 ?? '', macroN1: m.macroN1 ?? '', metodo: 'MANUAL',
      fechaOrden: Number.MAX_SAFE_INTEGER, razonSocial: m.razonSocial, estadoStd: m.estadoHabitual,
    })
  }
  for (const rec of rows) observeExportRow(builder, rec, schema, cols, segSeed, estSeed)
  const { maestro } = builder.build()

  const estadoByRif = new Map<string, string>()
  for (const [k, entry] of maestro) if (entry.estadoHabitual) estadoByRif.set(k, entry.estadoHabitual)

  const seg: SegmentoContext = { index, maestro, fuzzyThreshold: 92, fuzzySuggestFloor: 80 }
  const est = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado, estadoByRif, SEEDS.estadoDiccionario)

  const lines = [
    exportHeaderLine(headers),
    ...rows.map((rec) => exportRowLine(rec, headers, schema, seg, est, 'v1', 'run-1')),
  ]
  return { lines, maestro }
}

function parseLine(headers: string[], line: string): Record<string, string> {
  const cells = line.split(',')
  return Object.fromEntries([...headers, ...OUTPUT_COLUMNS].map((h, i) => [h, cells[i]]))
}

const HEADERS = ['RIF', 'CANAL', 'EDO', 'CIUDAD']

describe('export — estado resolution end to end', () => {
  test.each([
    ['Zulia', 'ZULIA', 'EXACTO'],
    ['EDO. ZULIA', 'ZULIA', 'EXACTO'],
    ['DTTO CAPITAL', 'DISTRITO CAPITAL', 'DICCIONARIO'],
    ['La Guaira', 'VARGAS', 'DICCIONARIO'],
  ])('%s resolves to %s via %s in the exported columns', (crudo, esperado, metodo) => {
    const { lines } = runExport(HEADERS, [{ RIF: 'J-1', CANAL: 'Bodegas', EDO: crudo, CIUDAD: '' }])
    const row = parseLine(HEADERS, lines[1])
    expect(row.estado_std).toBe(esperado)
    expect(row.metodo_estado).toBe(metodo)
    expect(row.flag_registro).toBe('OK')
    expect(row.valor_original_estado).toBe(crudo)
  })

  test('a row with no usable estado is recovered by RIF from another row of the same client', () => {
    const { lines } = runExport(HEADERS, [
      { RIF: 'J-1', CANAL: 'Bodegas', EDO: 'Zulia', CIUDAD: '' },
      { RIF: 'J-1', CANAL: 'Bodegas', EDO: 'NO IDENTIFICADO', CIUDAD: '' },
    ])
    const recovered = parseLine(HEADERS, lines[2])
    expect(recovered.estado_std).toBe('ZULIA')
    expect(recovered.metodo_estado).toBe('RIF')
    expect(recovered.flag_registro).toBe('OK')
  })

  // No RIF, so the maestro cannot learn this client's state from Pass A and the CIUDAD step is
  // genuinely the one that fires. (With a RIF, Pass A observes LARA into the maestro and Pass B
  // reports RIF instead — also correct, just a different step.)
  test('the city fills in when the estado column is unusable and there is no RIF', () => {
    const { lines } = runExport(HEADERS, [
      { RIF: '', CANAL: 'Bodegas', EDO: 'N/A', CIUDAD: 'Barquisimeto' },
    ])
    const row = parseLine(HEADERS, lines[1])
    expect(row.estado_std).toBe('LARA')
    expect(row.metodo_estado).toBe('CIUDAD')
  })

  test('once a client\'s state is known, later rows report RIF rather than re-deriving from the city', () => {
    const { lines } = runExport(HEADERS, [
      { RIF: 'J-9', CANAL: 'Bodegas', EDO: 'N/A', CIUDAD: 'Barquisimeto' },
    ])
    const row = parseLine(HEADERS, lines[1])
    expect(row.estado_std).toBe('LARA')
    expect(row.metodo_estado).toBe('RIF')
  })

  test('an unresolvable estado stays empty and flags SIN_ESTADO — never imputed', () => {
    const { lines } = runExport(HEADERS, [
      { RIF: 'J-9', CANAL: 'Bodegas', EDO: 'ZONA COMERCIAL 4', CIUDAD: 'PUEBLO INEXISTENTE' },
    ])
    const row = parseLine(HEADERS, lines[1])
    expect(row.estado_std).toBe('')
    expect(row.metodo_estado).toBe('')
    expect(row.flag_registro).toBe('SIN_ESTADO')
  })

  test('a manual maestro entry carrying only an estado resolves the state without faking a segment', () => {
    const manual: MaestroEntry[] = [{
      rif: 'J-7', razonSocial: 'CLIENTE 7', segmentoN3: null, macroN1: null,
      metodo: 'MANUAL', confianza: 'N3', estadoHabitual: 'MIRANDA',
      fechaClasificacion: null, reglaCanonica: 'MANUAL',
    }]
    const { lines } = runExport(
      HEADERS,
      [{ RIF: 'J-7', CANAL: 'ALGO RARO QUE NO EXISTE', EDO: 'N/A', CIUDAD: '' }],
      manual,
    )
    const row = parseLine(HEADERS, lines[1])
    expect(row.estado_std).toBe('MIRANDA')
    expect(row.metodo_estado).toBe('RIF')
    // The segment is genuinely unknown, so the row must NOT come out OK with an empty segment.
    expect(row.segmento_n3_std).toBe('')
    expect(row.flag_registro).toBe('SIN_CLASIFICAR')
  })

  test('the maestro records the client\'s habitual estado as the mode across its rows', () => {
    const { maestro } = runExport(HEADERS, [
      { RIF: 'J-1', CANAL: 'Bodegas', EDO: 'Zulia', CIUDAD: '' },
      { RIF: 'J-1', CANAL: 'Bodegas', EDO: 'Zulia', CIUDAD: '' },
      { RIF: 'J-1', CANAL: 'Bodegas', EDO: 'Miranda', CIUDAD: '' },
    ])
    expect(maestro.get('J1')?.estadoHabitual).toBe('ZULIA')
  })
})
