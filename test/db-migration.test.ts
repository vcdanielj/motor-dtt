import 'fake-indexeddb/auto'
import { test, expect, describe } from 'vitest'
import { openDB } from 'idb'
import {
  getLearnedDiccionario, getLearnedEstados, getManualMaestro, getMeta,
  putLearnedEstado, clearLearned,
} from '@/storage/db'

// Production concern, not a hypothetical: anyone who has used the app already has a v1 database
// holding everything they taught the motor. Adding the estadoDiccionario store bumps the version,
// so the upgrade path has to be additive — it must create the new store WITHOUT dropping the two
// that already exist or the meta values (fuzzy thresholds) alongside them.
describe('IndexedDB v1 → v2 migration', () => {
  test('a pre-existing v1 database keeps its data and gains the estado store', async () => {
    // Build a database exactly as version 1 of the app left it, then close it so the app's own
    // lazy open (version 2) performs the upgrade.
    const v1 = await openDB('motor-dtt', 1, {
      upgrade(db) {
        db.createObjectStore('diccionario', { keyPath: 'variante' })
        db.createObjectStore('maestro', { keyPath: 'rif' })
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
    await v1.put('diccionario', {
      variante: 'ABASTOS VIEJOS', segmentoN3: 'ABASTO', macroN1: 'TRADE TRADICIONAL (UTT)',
      codigo: 'UTT-01', metodo: 'EXACTO', activa: true,
    })
    await v1.put('maestro', {
      rif: 'J111', razonSocial: 'CLIENTE V1', segmentoN3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)',
      metodo: 'MANUAL', confianza: 'N3', estadoHabitual: null, fechaClasificacion: null,
      reglaCanonica: 'MANUAL',
    })
    await v1.put('meta', { key: 'fuzzyThreshold', value: 95 })
    v1.close()

    // Everything the analyst had taught the motor survives the upgrade…
    expect(await getLearnedDiccionario()).toHaveLength(1)
    expect((await getLearnedDiccionario())[0].variante).toBe('ABASTOS VIEJOS')
    expect(await getManualMaestro()).toHaveLength(1)
    expect(await getMeta('fuzzyThreshold', 92)).toBe(95)

    // …and the new store is there, usable, and cleared by resetLearned along with the rest.
    expect(await getLearnedEstados()).toEqual([])
    await putLearnedEstado({ variante: 'ZONA X', estadoStd: 'ZULIA', activa: true })
    expect(await getLearnedEstados()).toHaveLength(1)

    await clearLearned()
    expect(await getLearnedEstados()).toEqual([])
    expect(await getLearnedDiccionario()).toEqual([])
    expect(await getManualMaestro()).toEqual([])
    // clearLearned deliberately leaves meta alone — thresholds are config, not learning.
    expect(await getMeta('fuzzyThreshold', 92)).toBe(95)
  })
})
