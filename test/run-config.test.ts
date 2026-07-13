import 'fake-indexeddb/auto'
import { test, expect, describe } from 'vitest'
import { mergeDiccionario, loadRunConfig } from '@/storage/run-config'
import { putLearnedDiccionario, putManualMaestro } from '@/storage/db'
import { buildIndex, resolveSegmento, type SegmentoContext } from '@/pipeline/segmento'
import { SEEDS } from '@/seeds'
import type { DiccionarioEntry } from '@/contracts/config'

const seed: DiccionarioEntry[] = [
  { variante: 'ABASTOS', segmentoN3: 'OLD_N3', macroN1: 'OLD_MACRO', codigo: 'C-OLD', metodo: 'EXACTO', activa: true },
  { variante: 'BODEGAS', segmentoN3: 'BODEGA', macroN1: 'UTT', codigo: 'C-BOD', metodo: 'EXACTO', activa: true },
]

describe('mergeDiccionario', () => {
  test('learned overrides seed on the same normalized variante', () => {
    const learned: DiccionarioEntry[] = [
      { variante: 'abastos', segmentoN3: 'NEW_N3', macroN1: 'NEW_MACRO', codigo: 'C-NEW', metodo: 'EXACTO', activa: true },
    ]
    const merged = mergeDiccionario(seed, learned)
    expect(merged).toHaveLength(2) // BODEGAS untouched + ABASTOS overridden (not duplicated)
    const abastos = merged.find((e) => e.variante.toUpperCase() === 'ABASTOS')
    expect(abastos?.segmentoN3).toBe('NEW_N3')
  })

  test('disjoint entries are all present', () => {
    const learned: DiccionarioEntry[] = [
      { variante: 'CANAL NUEVO', segmentoN3: 'N3', macroN1: 'M', codigo: 'C', metodo: 'EXACTO', activa: true },
    ]
    const merged = mergeDiccionario(seed, learned)
    expect(merged).toHaveLength(3)
  })

  test('is pure — does not mutate its inputs', () => {
    const seedCopy = seed.map((e) => ({ ...e }))
    const learned: DiccionarioEntry[] = [
      { variante: 'ABASTOS', segmentoN3: 'NEW_N3', macroN1: 'NEW_MACRO', codigo: 'C-NEW', metodo: 'EXACTO', activa: true },
    ]
    mergeDiccionario(seedCopy, learned)
    expect(seedCopy).toEqual(seed)
  })
})

describe('mergeDiccionario + buildIndex + resolveSegmento — integration', () => {
  test('a learned variant resolves as EXACTO to the learned N3', () => {
    const learned: DiccionarioEntry[] = [
      { variante: 'CANAL NUEVO XYZ', segmentoN3: 'MI SEGMENTO', macroN1: 'MI MACRO', codigo: 'CX', metodo: 'EXACTO', activa: true },
    ]
    const merged = mergeDiccionario(SEEDS.diccionario, learned)
    const index = buildIndex(merged)
    const ctx: SegmentoContext = { index, maestro: new Map(), fuzzyThreshold: 92, fuzzySuggestFloor: 80 }

    const result = resolveSegmento({ rif: null, crudo: 'Canal Nuevo XYZ' }, ctx)
    expect(result.metodo).toBe('EXACTO')
    expect(result.segmentoN3).toBe('MI SEGMENTO')
    expect(result.macroN1).toBe('MI MACRO')
  })
})

describe('loadRunConfig', () => {
  test('falls back to SEEDS-only + empty manualMaestro when IndexedDB is empty', async () => {
    const cfg = await loadRunConfig()
    expect(cfg.diccionario.length).toBe(SEEDS.diccionario.length)
    expect(cfg.manualMaestro).toEqual([])
  })

  test('merges persisted learned diccionario + manual maestro from IndexedDB', async () => {
    await putLearnedDiccionario({
      variante: 'CANAL APRENDIDO', segmentoN3: 'N3_APRENDIDO', macroN1: 'MACRO_APRENDIDO', codigo: 'C-LEARNED', metodo: 'EXACTO', activa: true,
    })
    await putManualMaestro({
      rif: 'J-999', razonSocial: 'Cliente Manual', segmentoN3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)',
      metodo: 'MANUAL', confianza: 'N3', estadoHabitual: null, fechaClasificacion: null, reglaCanonica: 'MANUAL',
    })

    const cfg = await loadRunConfig()
    expect(cfg.diccionario.length).toBe(SEEDS.diccionario.length + 1)
    expect(cfg.manualMaestro).toHaveLength(1)
    expect(cfg.manualMaestro[0].razonSocial).toBe('Cliente Manual')
  })
})
