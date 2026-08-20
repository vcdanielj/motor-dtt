import { test, expect, describe } from 'vitest'
import { SEEDS } from '@/seeds'
import { buildIndex, buildMaestro, type SegmentoContext } from '@/pipeline/segmento'
import { buildEstadoContext, type EstadoContext } from '@/pipeline/estado'
import { processRow, outputColumns } from '@/pipeline/process-row'
import { OUTPUT_COLUMNS } from '@/contracts/row'

function makeSegCtx(): SegmentoContext {
  return {
    index: buildIndex(SEEDS.diccionario),
    maestro: buildMaestro([]),
    fuzzyThreshold: 92,
    fuzzySuggestFloor: 80,
  }
}

function makeEstCtx(): EstadoContext {
  return buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)
}

describe('processRow — happy path (segment EXACTO + estado EXACTO)', () => {
  test('Bodegas / Zulia resolves fully OK', () => {
    const seg = makeSegCtx()
    const est = makeEstCtx()
    const result = processRow(
      { rif: null, segmentoCrudo: 'Bodegas', estadoCrudo: 'Zulia', ciudad: null },
      seg,
      est,
    )
    expect(result.segmentoN3).toBe('Bodegas')
    expect(result.metodoSegmento).toBe('EXACTO')
    expect(result.estadoStd).toBe('ZULIA')
    expect(result.metodoEstado).toBe('EXACTO')
    expect(result.flagRegistro).toBe('OK')
    expect(result.valorOriginalSegmento).toBe('Bodegas')
    expect(result.valorOriginalEstado).toBe('Zulia')
  })
})

describe('processRow — flag precedence: SIN_CLASIFICAR dominates SIN_ESTADO', () => {
  test('unknown segment but valid estado -> SIN_CLASIFICAR, estadoStd still set', () => {
    const seg = makeSegCtx()
    const est = makeEstCtx()
    const result = processRow(
      { rif: null, segmentoCrudo: 'ZZZ NEGOCIO RARO 12345', estadoCrudo: 'Zulia', ciudad: null },
      seg,
      est,
    )
    expect(result.flagRegistro).toBe('SIN_CLASIFICAR')
    expect(result.estadoStd).toBe('ZULIA')
    expect(result.segmentoN3).toBeNull()
  })
})

describe('processRow — SIN_ESTADO when segment resolves but estado does not', () => {
  test('good segment, NO IDENTIFICADO estado, no ciudad -> SIN_ESTADO', () => {
    const seg = makeSegCtx()
    const est = makeEstCtx()
    const result = processRow(
      { rif: null, segmentoCrudo: 'Bodegas', estadoCrudo: 'NO IDENTIFICADO', ciudad: null },
      seg,
      est,
    )
    expect(result.flagRegistro).toBe('SIN_ESTADO')
    expect(result.segmentoN3).toBe('Bodegas')
    expect(result.estadoStd).toBeNull()
  })
})

describe('processRow — null crudo fields never throw and produce empty originals', () => {
  test('all-null fields', () => {
    const seg = makeSegCtx()
    const est = makeEstCtx()
    expect(() =>
      processRow({ rif: null, segmentoCrudo: null, estadoCrudo: null, ciudad: null }, seg, est),
    ).not.toThrow()
    const result = processRow({ rif: null, segmentoCrudo: null, estadoCrudo: null, ciudad: null }, seg, est)
    expect(result.valorOriginalSegmento).toBe('')
    expect(result.valorOriginalEstado).toBe('')
    expect(result.flagRegistro).toBe('SIN_CLASIFICAR')
  })
})

describe('outputColumns', () => {
  test('returns exactly the 11 OUTPUT_COLUMNS keys, string values, run_id/version filled', () => {
    const seg = makeSegCtx()
    const est = makeEstCtx()
    const result = processRow(
      { rif: null, segmentoCrudo: 'Bodegas', estadoCrudo: 'Zulia', ciudad: null },
      seg,
      est,
    )
    const cols = outputColumns(result, 'v1.2', 'run-abc')
    expect(Object.keys(cols).sort()).toEqual([...OUTPUT_COLUMNS].sort())
    for (const v of Object.values(cols)) {
      expect(typeof v).toBe('string')
    }
    expect(cols.version_diccionario).toBe('v1.2')
    expect(cols.run_id).toBe('run-abc')
    expect(cols.segmento_n3_std).toBe('Bodegas')
    expect(cols.estado_std).toBe('ZULIA')
    expect(cols.flag_registro).toBe('OK')
    expect(cols.valor_original_segmento).toBe('Bodegas')
    expect(cols.valor_original_estado).toBe('Zulia')
  })

  test('null fields become empty strings, not "null"', () => {
    const seg = makeSegCtx()
    const est = makeEstCtx()
    const result = processRow({ rif: null, segmentoCrudo: null, estadoCrudo: null, ciudad: null }, seg, est)
    const cols = outputColumns(result, 'v1', 'run-1')
    expect(cols.segmento_n3_std).toBe('')
    expect(cols.macro_canal_n1_std).toBe('')
    expect(cols.metodo_segmento).toBe('')
    expect(cols.confianza_segmento).toBe('')
    expect(cols.estado_std).toBe('')
    expect(cols.metodo_estado).toBe('')
  })
})
