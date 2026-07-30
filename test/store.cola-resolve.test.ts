import 'fake-indexeddb/auto'
import { test, expect, describe, beforeEach } from 'vitest'
import { useStore } from '@/state/store'
import { getLearnedDiccionario, getManualMaestro, clearLearned } from '@/storage/db'
import { mergeDiccionario } from '@/storage/run-config'
import { buildIndex, resolveSegmento, type SegmentoContext } from '@/pipeline/segmento'
import { SEEDS } from '@/seeds'
import type { ColaItem } from '@/contracts/cola'

const VARIANTE_ITEM: ColaItem = {
  id: 'test-variante',
  dominio: 'SEGMENTO',
  tipo: 'VARIANTE_NUEVA',
  valorCrudo: 'CANAL RARO XYZ',
  registrosAfectados: 10,
  tonAfectadas: 1.2,
  sugerenciaFuzzy: null,
  resolucion: null,
}

const ALTO_VOLUMEN_ITEM: ColaItem = {
  id: 'test-alto-volumen',
  dominio: 'SEGMENTO',
  tipo: 'ALTO_VOLUMEN_SIN_CLASIFICAR',
  valorCrudo: 'MAYORISTA SIN NOMBRE',
  registrosAfectados: 20,
  tonAfectadas: 2.4,
  sugerenciaFuzzy: null,
  resolucion: null,
}

const CONFLICTO_ITEM: ColaItem = {
  id: 'test-conflicto',
  dominio: 'SEGMENTO',
  tipo: 'CONFLICTO_MAYOR',
  valorCrudo: 'J-12345678-9',
  registrosAfectados: 5,
  tonAfectadas: 0.5,
  sugerenciaFuzzy: null,
  resolucion: null,
}

beforeEach(async () => {
  await clearLearned()
  useStore.setState({ cola: [VARIANTE_ITEM, ALTO_VOLUMEN_ITEM, CONFLICTO_ITEM] })
  await useStore.getState().refreshLearned()
})

describe('resolveColaItem — VARIANTE_NUEVA / ALTO_VOLUMEN_SIN_CLASIFICAR -> learned diccionario', () => {
  test('writes a learned diccionario entry keyed by the raw segment string, marks resolucion, bumps the count', async () => {
    const seg = useStore.getState().seeds.segmentos[0]
    await useStore.getState().resolveColaItem('test-variante', seg.n3)

    const learned = await getLearnedDiccionario()
    expect(learned).toHaveLength(1)
    expect(learned[0]).toMatchObject({
      segmentoN3: seg.n3,
      macroN1: seg.macroN1,
      codigo: seg.codigo,
      metodo: 'EXACTO',
      activa: true,
    })

    const item = useStore.getState().cola.find((c) => c.id === 'test-variante')
    expect(item?.resolucion).toBe(seg.n3)
    expect(useStore.getState().learned.diccionario).toBe(1)
    // untouched item keeps its list slot and null resolucion
    expect(useStore.getState().cola.find((c) => c.id === 'test-alto-volumen')?.resolucion).toBeNull()
  })

  test('ALTO_VOLUMEN_SIN_CLASIFICAR also resolves into the diccionario (not the maestro)', async () => {
    const seg = useStore.getState().seeds.segmentos[1]
    await useStore.getState().resolveColaItem('test-alto-volumen', seg.n3)

    expect(await getLearnedDiccionario()).toHaveLength(1)
    expect(await getManualMaestro()).toHaveLength(0)
    expect(useStore.getState().cola.find((c) => c.id === 'test-alto-volumen')?.resolucion).toBe(seg.n3)
  })

  test('round-trip: mergeDiccionario + buildIndex + resolveSegmento resolves the learned variant as EXACTO', async () => {
    const seg = useStore.getState().seeds.segmentos[0]
    await useStore.getState().resolveColaItem('test-variante', seg.n3)

    const learned = await getLearnedDiccionario()
    const merged = mergeDiccionario(SEEDS.diccionario, learned)
    const index = buildIndex(merged)
    const ctx: SegmentoContext = { index, maestro: new Map(), fuzzyThreshold: 92, fuzzySuggestFloor: 80 }

    const result = resolveSegmento({ rif: null, crudo: VARIANTE_ITEM.valorCrudo }, ctx)
    expect(result.metodo).toBe('EXACTO')
    expect(result.segmentoN3).toBe(seg.n3)
    expect(result.macroN1).toBe(seg.macroN1)
  })
})

describe('resolveColaItem — CONFLICTO_MAYOR -> manual maestro', () => {
  test('writes a MANUAL maestro entry keyed by the RIF, marks resolucion, bumps the count', async () => {
    const seg = useStore.getState().seeds.segmentos[2]
    await useStore.getState().resolveColaItem('test-conflicto', seg.n3)

    const maestro = await getManualMaestro()
    expect(maestro).toHaveLength(1)
    expect(maestro[0]).toMatchObject({
      segmentoN3: seg.n3,
      macroN1: seg.macroN1,
      metodo: 'MANUAL',
      confianza: 'N3',
      reglaCanonica: 'MANUAL',
    })

    const item = useStore.getState().cola.find((c) => c.id === 'test-conflicto')
    expect(item?.resolucion).toBe(seg.n3)
    expect(useStore.getState().learned.maestro).toBe(1)
    expect(await getLearnedDiccionario()).toHaveLength(0)
  })
})

describe('resolveColaItem — safety no-ops', () => {
  test('unknown item id is a no-op', async () => {
    await useStore.getState().resolveColaItem('nonexistent', useStore.getState().seeds.segmentos[0].n3)
    expect(await getLearnedDiccionario()).toHaveLength(0)
    expect(await getManualMaestro()).toHaveLength(0)
  })

  test('unknown segmentoN3 is a no-op (never crashes)', async () => {
    await useStore.getState().resolveColaItem('test-variante', 'NOT_A_REAL_N3')
    expect(await getLearnedDiccionario()).toHaveLength(0)
    expect(useStore.getState().cola.find((c) => c.id === 'test-variante')?.resolucion).toBeNull()
  })
})
