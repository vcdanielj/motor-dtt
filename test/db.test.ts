import 'fake-indexeddb/auto'
import { test, expect, describe } from 'vitest'
import {
  getLearnedDiccionario,
  putLearnedDiccionario,
  getManualMaestro,
  putManualMaestro,
  getMeta,
  putMeta,
  clearLearned,
} from '@/storage/db'

const ENTRY_A = { variante: 'Nuevo Canal', segmentoN3: 'Bodegas', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-02', metodo: 'EXACTO' as const, activa: true }
const ENTRY_B = { variante: 'nuevo   canal', segmentoN3: 'Kioscos', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-07', metodo: 'EXACTO' as const, activa: true }

const MAESTRO_A = {
  rif: 'J-500.522.657', razonSocial: 'Cliente A', segmentoN3: 'Bodegas', macroN1: 'TRADE TRADICIONAL',
  metodo: 'MANUAL' as const, confianza: 'N3' as const, estadoHabitual: null, fechaClasificacion: null, reglaCanonica: 'MANUAL' as const,
}
const MAESTRO_B = { ...MAESTRO_A, rif: 'j500522657', razonSocial: 'Cliente B' }

describe('storage/db — diccionario store', () => {
  test('put/get round-trip', async () => {
    await putLearnedDiccionario(ENTRY_A)
    const all = await getLearnedDiccionario()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ segmentoN3: 'Bodegas', variante: 'NUEVO CANAL' })
  })

  test('two casings of the same variante collapse into one entry (normalized key)', async () => {
    await putLearnedDiccionario(ENTRY_A)
    await putLearnedDiccionario(ENTRY_B) // same normalized variante, different casing/spacing
    const all = await getLearnedDiccionario()
    expect(all).toHaveLength(1)
    expect(all[0].segmentoN3).toBe('Kioscos') // second put wins
  })
})

describe('storage/db — maestro store', () => {
  test('put/get round-trip, keyed by normalizeRif', async () => {
    await putManualMaestro(MAESTRO_A)
    const all = await getManualMaestro()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ razonSocial: 'Cliente A', rif: 'J500522657' })
  })

  test('two RIF formats that normalize the same collapse into one entry', async () => {
    await putManualMaestro(MAESTRO_A)
    await putManualMaestro(MAESTRO_B) // 'J-500.522.657' vs 'j500522657' -> same normalized key
    const all = await getManualMaestro()
    expect(all).toHaveLength(1)
    expect(all[0].razonSocial).toBe('Cliente B') // second put wins
  })
})

describe('storage/db — meta store', () => {
  test('getMeta falls back when the key is absent', async () => {
    expect(await getMeta('missing-key', 'fallback')).toBe('fallback')
  })

  test('putMeta/getMeta round-trip', async () => {
    await putMeta('versionDiccionario', 'v2')
    expect(await getMeta('versionDiccionario', 'v1')).toBe('v2')
  })
})

describe('storage/db — clearLearned', () => {
  test('wipes diccionario and maestro but keeps meta', async () => {
    await putLearnedDiccionario(ENTRY_A)
    await putManualMaestro(MAESTRO_A)
    await putMeta('keepMe', 42)

    await clearLearned()

    expect(await getLearnedDiccionario()).toEqual([])
    expect(await getManualMaestro()).toEqual([])
    expect(await getMeta('keepMe', 0)).toBe(42)
  })
})
