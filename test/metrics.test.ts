import { test, expect, describe } from 'vitest'
import { MetricsAccumulator, scdcCrudoPct, scdcPostPct, type DistribuidorMetric } from '@/pipeline/metrics'
import type { ResolvedRow } from '@/pipeline/process-row'

function row(overrides: Partial<ResolvedRow> = {}): ResolvedRow {
  return {
    segmentoN3: 'BODEGA',
    macroN1: 'BODEGONES',
    metodoSegmento: 'EXACTO',
    confianzaSegmento: 'N3',
    estadoStd: 'ZULIA',
    metodoEstado: 'EXACTO',
    flagRegistro: 'OK',
    sugerenciaSegmento: null,
    sugerenciaEstado: null,
    valorOriginalSegmento: 'Bodegas',
    valorOriginalEstado: 'Zulia',
    ...overrides,
  }
}

describe('MetricsAccumulator — per-distributor tallies', () => {
  test('accumulates registros/exactoCrudo/resueltoPost/estadoValido/ton across two distributors', () => {
    const acc = new MetricsAccumulator()

    // Distribuidor A: 3 rows — 2 EXACTO+OK, 1 SIN_CLASIFICAR (segment unresolved but has estado)
    acc.add('A', row({ metodoSegmento: 'EXACTO', flagRegistro: 'OK' }), 100)
    acc.add('A', row({ metodoSegmento: 'EXACTO', flagRegistro: 'OK' }), 50)
    acc.add(
      'A',
      row({ metodoSegmento: null, segmentoN3: null, macroN1: null, confianzaSegmento: null, flagRegistro: 'SIN_CLASIFICAR' }),
      10,
    )

    // Distribuidor B: 2 rows — 1 MAESTRO+OK, 1 FUZZY+OK
    acc.add('B', row({ metodoSegmento: 'MAESTRO', flagRegistro: 'OK' }), 500)
    acc.add('B', row({ metodoSegmento: 'FUZZY', flagRegistro: 'OK' }), 40)

    const dists = acc.distribuidores()
    expect(dists).toHaveLength(2)

    // sorted by ton desc: B (540) before A (160)
    expect(dists[0].nombre).toBe('B')
    expect(dists[1].nombre).toBe('A')

    const a = dists.find((d) => d.nombre === 'A') as DistribuidorMetric
    expect(a.registros).toBe(3)
    expect(a.exactoCrudo).toBe(2) // only metodoSegmento === 'EXACTO'
    expect(a.resueltoPost).toBe(2) // flagRegistro !== 'SIN_CLASIFICAR'
    expect(a.estadoValido).toBe(3) // estadoStd set on all 3 rows (per `row()` default)
    expect(a.ton).toBe(160)
    expect(a.tonSinClasificar).toBe(10)
    expect(a.metodo.EXACTO).toBe(2)
    expect(a.metodo.SIN_CLASIFICAR).toBe(1)

    const b = dists.find((d) => d.nombre === 'B') as DistribuidorMetric
    expect(b.registros).toBe(2)
    expect(b.exactoCrudo).toBe(0) // MAESTRO/FUZZY are not EXACTO
    expect(b.resueltoPost).toBe(2)
    expect(b.ton).toBe(540)
    expect(b.metodo.MAESTRO).toBe(1)
    expect(b.metodo.FUZZY).toBe(1)
  })

  test('scdcCrudoPct / scdcPostPct compute percentages to 1 decimal', () => {
    const acc = new MetricsAccumulator()
    acc.add('A', row({ metodoSegmento: 'EXACTO', flagRegistro: 'OK' }), 1)
    acc.add('A', row({ metodoSegmento: 'EXACTO', flagRegistro: 'OK' }), 1)
    acc.add(
      'A',
      row({ metodoSegmento: null, segmentoN3: null, macroN1: null, confianzaSegmento: null, flagRegistro: 'SIN_CLASIFICAR' }),
      1,
    )
    const a = acc.distribuidores()[0]
    // exactoCrudo=2, registros=3 -> 66.7%; resueltoPost=2 -> 66.7%
    expect(scdcCrudoPct(a)).toBe(66.7)
    expect(scdcPostPct(a)).toBe(66.7)
  })

  test('non-finite ton is guarded to 0', () => {
    const acc = new MetricsAccumulator()
    acc.add('A', row(), NaN)
    acc.add('A', row(), Infinity)
    acc.add('A', row(), -Infinity)
    acc.add('A', row(), 25)
    const a = acc.distribuidores()[0]
    expect(a.ton).toBe(25)
    expect(a.registros).toBe(4)
  })

  test('registros with zero total yields 0% (no divide-by-zero NaN)', () => {
    // no rows added for this distributor at all -> distribuidores() has no entry;
    // build a DistribuidorMetric with registros 0 directly to test the pure helper.
    const empty: DistribuidorMetric = {
      nombre: 'Empty',
      registros: 0,
      exactoCrudo: 0,
      resueltoPost: 0,
      estadoValido: 0,
      ton: 0,
      tonSinClasificar: 0,
      metodo: { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 },
    estadoExactoCrudo: 0,
    metodoEstado: { EXACTO: 0, DICCIONARIO: 0, RIF: 0, CIUDAD: 0, FUZZY: 0, SIN_ESTADO: 0 },
    }
    expect(scdcCrudoPct(empty)).toBe(0)
    expect(scdcPostPct(empty)).toBe(0)
  })
})

describe('MetricsAccumulator — totals()', () => {
  test('tallies across all distributors by metodoSegmento / metodoEstado / ton', () => {
    const acc = new MetricsAccumulator()
    acc.add('A', row({ metodoSegmento: 'EXACTO', metodoEstado: 'EXACTO', flagRegistro: 'OK' }), 100)
    acc.add('A', row({ metodoSegmento: 'MAESTRO', metodoEstado: 'RIF', flagRegistro: 'OK' }), 50)
    acc.add(
      'B',
      row({
        metodoSegmento: null,
        segmentoN3: null,
        macroN1: null,
        confianzaSegmento: null,
        flagRegistro: 'SIN_CLASIFICAR',
        metodoEstado: null,
        estadoStd: null,
      }),
      10,
    )

    const totals = acc.totals()
    expect(totals.registros).toBe(3)
    expect(totals.porMetodoSegmento.EXACTO).toBe(1)
    expect(totals.porMetodoSegmento.MAESTRO).toBe(1)
    expect(totals.porMetodoSegmento.SIN_CLASIFICAR).toBe(1)
    expect(totals.porMetodoEstado.EXACTO).toBe(1)
    expect(totals.porMetodoEstado.RIF).toBe(1)
    expect(totals.porMetodoEstado.SIN_ESTADO).toBe(1)
    expect(totals.estadoValido).toBe(2)
    expect(totals.ton).toBe(160)
  })
})
