import { createColaAccumulator } from '@/pipeline/cola'
import type { ResolvedRow } from '@/pipeline/process-row'

function sinClasificarConSugerencia(segmentoN3: string, score: number): ResolvedRow {
  return {
    segmentoN3: null,
    macroN1: null,
    metodoSegmento: null,
    confianzaSegmento: null,
    estadoStd: 'MIRANDA',
    metodoEstado: 'EXACTO',
    flagRegistro: 'SIN_CLASIFICAR',
    sugerenciaSegmento: { segmentoN3, macroN1: 'MACRO', score },
    valorOriginalSegmento: '',
    valorOriginalEstado: '',
  }
}

function sinClasificarSinSugerencia(): ResolvedRow {
  return {
    segmentoN3: null,
    macroN1: null,
    metodoSegmento: null,
    confianzaSegmento: null,
    estadoStd: 'MIRANDA',
    metodoEstado: 'EXACTO',
    flagRegistro: 'SIN_CLASIFICAR',
    sugerenciaSegmento: null,
    valorOriginalSegmento: '',
    valorOriginalEstado: '',
  }
}

function ok(): ResolvedRow {
  return {
    segmentoN3: 'ABASTOS',
    macroN1: 'MACRO',
    metodoSegmento: 'EXACTO',
    confianzaSegmento: 'N3',
    estadoStd: 'MIRANDA',
    metodoEstado: 'EXACTO',
    flagRegistro: 'OK',
    sugerenciaSegmento: null,
    valorOriginalSegmento: '',
    valorOriginalEstado: '',
  }
}

test('groups 80-91 suggestion rows into VARIANTE_NUEVA by normalized crudo', () => {
  const acc = createColaAccumulator()
  acc.addRow('super. minimarts', sinClasificarConSugerencia('MINI MARKET', 87), 10)
  acc.addRow('SUPER. MINIMARTS', sinClasificarConSugerencia('MINI MARKET', 87), 5)

  const items = acc.build()
  expect(items).toHaveLength(1)
  expect(items[0]).toMatchObject({
    tipo: 'VARIANTE_NUEVA',
    valorCrudo: 'SUPER. MINIMARTS',
    registrosAfectados: 2,
    tonAfectadas: 15,
    sugerenciaFuzzy: { segmentoN3: 'MINI MARKET', score: 87 },
    resolucion: null,
  })
})

test('groups unresolved rows with no suggestion into ALTO_VOLUMEN_SIN_CLASIFICAR', () => {
  const acc = createColaAccumulator()
  acc.addRow('mayorista s/n', sinClasificarSinSugerencia(), 100)
  acc.addRow('MAYORISTA S/N', sinClasificarSinSugerencia(), 43.9)

  const items = acc.build()
  expect(items).toHaveLength(1)
  expect(items[0].tipo).toBe('ALTO_VOLUMEN_SIN_CLASIFICAR')
  expect(items[0].sugerenciaFuzzy).toBeNull()
  expect(items[0].registrosAfectados).toBe(2)
  expect(items[0].tonAfectadas).toBeCloseTo(143.9)
})

test('excludes empty-crudo rows (those need the maestro, not the cola)', () => {
  const acc = createColaAccumulator()
  acc.addRow('', sinClasificarSinSugerencia(), 1000)
  acc.addRow('   ', sinClasificarConSugerencia('MINI MARKET', 85), 1000)
  expect(acc.build()).toHaveLength(0)
})

test('ignores OK rows entirely', () => {
  const acc = createColaAccumulator()
  acc.addRow('bodega el sol', ok(), 1000)
  expect(acc.build()).toHaveLength(0)
})

test('build() sorts by tonAfectadas desc and caps at maxItems', () => {
  const acc = createColaAccumulator()
  acc.addRow('bajo volumen', sinClasificarSinSugerencia(), 1)
  acc.addRow('alto volumen', sinClasificarSinSugerencia(), 500)
  acc.addRow('medio volumen', sinClasificarSinSugerencia(), 50)

  const items = acc.build(2)
  expect(items).toHaveLength(2)
  expect(items.map((i) => i.valorCrudo)).toEqual(['ALTO VOLUMEN', 'MEDIO VOLUMEN'])
})

test('produces deterministic, non-random ids stable across accumulator instances', () => {
  const a = createColaAccumulator()
  a.addRow('Panaderia-Pasteleria', sinClasificarConSugerencia('PANADERIA', 82), 2.1)
  const b = createColaAccumulator()
  b.addRow('Panaderia-Pasteleria', sinClasificarConSugerencia('PANADERIA', 82), 2.1)

  expect(a.build()[0].id).toBe(b.build()[0].id)
  expect(a.build()[0].id).toMatch(/^variante_nueva-/)
})
