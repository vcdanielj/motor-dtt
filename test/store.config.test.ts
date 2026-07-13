import 'fake-indexeddb/auto'
import { test, expect, describe, beforeEach } from 'vitest'
import { useStore } from '@/state/store'
import { adapters } from '@/adapters'
import {
  getLearnedDiccionario, getManualMaestro, putLearnedDiccionario, putManualMaestro,
  getMeta, clearLearned,
} from '@/storage/db'
import { mergeDiccionario } from '@/storage/run-config'
import { buildIndex, resolveSegmento, type SegmentoContext } from '@/pipeline/segmento'
import { SEEDS } from '@/seeds'

beforeEach(async () => {
  await clearLearned()
  useStore.setState({ thresholds: { fuzzyThreshold: 92, fuzzySuggestFloor: 80 } })
  await useStore.getState().refreshLearned()
})

describe('saveThresholds', () => {
  test('persists valid values and updates the store', async () => {
    await useStore.getState().saveThresholds(95, 70)
    expect(useStore.getState().thresholds).toEqual({ fuzzyThreshold: 95, fuzzySuggestFloor: 70 })
    expect(await getMeta('fuzzyThreshold', 0)).toBe(95)
    expect(await getMeta('fuzzySuggestFloor', 0)).toBe(70)
  })

  test('clamps the floor into [50,99]', async () => {
    await useStore.getState().saveThresholds(95, 10)
    expect(useStore.getState().thresholds.fuzzySuggestFloor).toBe(50)

    await useStore.getState().saveThresholds(95, 500)
    expect(useStore.getState().thresholds.fuzzySuggestFloor).toBe(99)
  })

  test('clamps the threshold into [floor,100], keeping floor <= threshold', async () => {
    // threshold below the (clamped) floor gets pulled up to the floor
    await useStore.getState().saveThresholds(60, 70)
    expect(useStore.getState().thresholds).toEqual({ fuzzyThreshold: 70, fuzzySuggestFloor: 70 })

    // threshold above 100 gets capped
    await useStore.getState().saveThresholds(500, 80)
    expect(useStore.getState().thresholds.fuzzyThreshold).toBe(100)
  })

  test('rounds fractional inputs', async () => {
    await useStore.getState().saveThresholds(92.6, 79.4)
    expect(useStore.getState().thresholds).toEqual({ fuzzyThreshold: 93, fuzzySuggestFloor: 79 })
  })
})

describe('importDiccionarioCsv', () => {
  test('adds rows whose segmento_n3 matches the catalog, skips unknown segments and empty variantes', async () => {
    const seg = useStore.getState().seeds.segmentos[0]
    const csv = `variante,segmento_n3\n` +
      `CANAL IMPORTADO,${seg.n3}\n` +
      `,${seg.n3}\n` +
      `OTRO CANAL,NO_EXISTE_EN_CATALOGO\n`
    const file = new File([csv], 'diccionario.csv', { type: 'text/csv' })

    const result = await useStore.getState().importDiccionarioCsv(file)
    expect(result).toEqual({ added: 1, skipped: 2 })

    const learned = await getLearnedDiccionario()
    expect(learned).toHaveLength(1)
    expect(learned[0]).toMatchObject({
      segmentoN3: seg.n3, macroN1: seg.macroN1, codigo: seg.codigo, metodo: 'EXACTO', activa: true,
    })
    expect(useStore.getState().learned.diccionario).toBe(1)
  })

  test('accepts the segmentoN3 header spelling, case-insensitively', async () => {
    const seg = useStore.getState().seeds.segmentos[1]
    const csv = `Variante,SegmentoN3\nOTRA VARIANTE,${seg.n3}\n`
    const file = new File([csv], 'diccionario.csv', { type: 'text/csv' })

    const result = await useStore.getState().importDiccionarioCsv(file)
    expect(result).toEqual({ added: 1, skipped: 0 })
  })

  test('a file missing the expected headers skips every row without crashing', async () => {
    const csv = `foo,bar\nx,y\n`
    const file = new File([csv], 'bad.csv', { type: 'text/csv' })

    const result = await useStore.getState().importDiccionarioCsv(file)
    expect(result).toEqual({ added: 0, skipped: 1 })
    expect(await getLearnedDiccionario()).toHaveLength(0)
  })

  test('round-trip: the imported variant resolves EXACTO via mergeDiccionario + buildIndex + resolveSegmento', async () => {
    const seg = useStore.getState().seeds.segmentos[2]
    const csv = `variante,segmento_n3\nCANAL DESDE ARCHIVO,${seg.n3}\n`
    const file = new File([csv], 'diccionario.csv', { type: 'text/csv' })

    await useStore.getState().importDiccionarioCsv(file)

    const learned = await getLearnedDiccionario()
    const merged = mergeDiccionario(SEEDS.diccionario, learned)
    const index = buildIndex(merged)
    const ctx: SegmentoContext = { index, maestro: new Map(), fuzzyThreshold: 92, fuzzySuggestFloor: 80 }

    const result = resolveSegmento({ rif: null, crudo: 'Canal Desde Archivo' }, ctx)
    expect(result.metodo).toBe('EXACTO')
    expect(result.segmentoN3).toBe(seg.n3)
    expect(result.macroN1).toBe(seg.macroN1)
  })
})

describe('resetLearned', () => {
  test('empties both the learned diccionario and manual maestro stores', async () => {
    await putLearnedDiccionario({
      variante: 'X', segmentoN3: 'N3', macroN1: 'M', codigo: 'C', metodo: 'EXACTO', activa: true,
    })
    await putManualMaestro({
      rif: 'J-1', razonSocial: null, segmentoN3: 'N3', macroN1: 'M', metodo: 'MANUAL',
      confianza: 'N3', estadoHabitual: null, fechaClasificacion: null, reglaCanonica: 'MANUAL',
    })
    await useStore.getState().refreshLearned()
    expect(useStore.getState().learned).toEqual({ diccionario: 1, maestro: 1 })

    await useStore.getState().resetLearned()

    expect(await getLearnedDiccionario()).toEqual([])
    expect(await getManualMaestro()).toEqual([])
    expect(useStore.getState().learned).toEqual({ diccionario: 0, maestro: 0 })
  })
})

describe('export actions', () => {
  test('exportLearnedDiccionario builds a CSV with the expected header + a learned row, then saveBlob', async () => {
    await putLearnedDiccionario({
      variante: 'CANAL X', segmentoN3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)', codigo: 'UTT-02',
      metodo: 'EXACTO', activa: true,
    })

    let savedBlob: Blob | undefined
    let savedName: string | undefined
    const original = adapters.saveBlob
    adapters.saveBlob = async (blob, name) => {
      savedBlob = blob
      savedName = name
      return 'saved'
    }
    try {
      await useStore.getState().exportLearnedDiccionario()
      expect(savedName).toBe('diccionario_aprendido.csv')
      expect(savedBlob).toBeDefined()
      const text = await savedBlob!.text()
      expect(text.startsWith('variante,segmento_n3,macro_canal_n1,codigo\r\n')).toBe(true)
      expect(text).toContain('CANAL X,BODEGA,TRADE TRADICIONAL (UTT),UTT-02')
    } finally {
      adapters.saveBlob = original
    }
  })

  test('exportManualMaestro builds a CSV with the expected header + a manual row, then saveBlob', async () => {
    await putManualMaestro({
      rif: 'J-500522657', razonSocial: 'Cliente A', segmentoN3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)',
      metodo: 'MANUAL', confianza: 'N3', estadoHabitual: null, fechaClasificacion: null, reglaCanonica: 'MANUAL',
    })

    let savedBlob: Blob | undefined
    let savedName: string | undefined
    const original = adapters.saveBlob
    adapters.saveBlob = async (blob, name) => {
      savedBlob = blob
      savedName = name
      return 'saved'
    }
    try {
      await useStore.getState().exportManualMaestro()
      expect(savedName).toBe('maestro_manual.csv')
      const text = await savedBlob!.text()
      expect(text.startsWith('rif,segmento_n3,macro_canal_n1,regla\r\n')).toBe(true)
      expect(text).toContain('J500522657,BODEGA,TRADE TRADICIONAL (UTT),MANUAL')
    } finally {
      adapters.saveBlob = original
    }
  })
})
