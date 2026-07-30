import 'fake-indexeddb/auto'
import { test, expect, describe, beforeEach } from 'vitest'
import { SEEDS } from '@/seeds'
import { createColaAccumulator } from '@/pipeline/cola'
import { applyEstadoRecovery } from '@/pipeline/recovery'
import { MetricsAccumulator, newEstadoTally } from '@/pipeline/metrics'
import { mergeEstadoDiccionario } from '@/storage/run-config'
import { loadRunConfig } from '@/storage/run-config'
import { normalizeText } from '@/ingest/normalize'
import { clearLearned, getLearnedEstados, putLearnedEstado } from '@/storage/db'
import { useStore } from '@/state/store'
import type { ResolvedRow } from '@/pipeline/process-row'
import type { MaestroEntry } from '@/contracts/maestro'

const row = (over: Partial<ResolvedRow> = {}): ResolvedRow => ({
  segmentoN3: 'BODEGA',
  macroN1: 'TRADE TRADICIONAL (UTT)',
  metodoSegmento: 'EXACTO',
  confianzaSegmento: 'N3',
  estadoStd: 'ZULIA',
  metodoEstado: 'EXACTO',
  flagRegistro: 'OK',
  sugerenciaSegmento: null,
  sugerenciaEstado: null,
  valorOriginalSegmento: 'BODEGA',
  valorOriginalEstado: 'ZULIA',
  ...over,
})

const sinEstado = (over: Partial<ResolvedRow> = {}) =>
  row({ estadoStd: null, metodoEstado: null, flagRegistro: 'SIN_ESTADO', ...over })

describe('cola accumulator — estado domain', () => {
  test('an unresolved state with a suggestion becomes ESTADO_VARIANTE_NUEVA', () => {
    const cola = createColaAccumulator()
    cola.addEstado('ZULYA', sinEstado({ sugerenciaEstado: { estadoStd: 'ZULIA', score: 85 } }), 10)
    const [item] = cola.build()
    expect(item).toMatchObject({
      dominio: 'ESTADO',
      tipo: 'ESTADO_VARIANTE_NUEVA',
      valorCrudo: 'ZULYA',
      sugerenciaFuzzy: { valor: 'ZULIA', score: 85 },
    })
  })

  test('an unresolved state with no suggestion becomes ESTADO_SIN_RESOLVER', () => {
    const cola = createColaAccumulator()
    cola.addEstado('ZONA COMERCIAL 4', sinEstado(), 5)
    expect(cola.build()[0]).toMatchObject({ dominio: 'ESTADO', tipo: 'ESTADO_SIN_RESOLVER' })
  })

  test('a resolved state produces no queue item at all', () => {
    const cola = createColaAccumulator()
    cola.addEstado('ZULIA', row(), 10)
    expect(cola.build()).toEqual([])
  })

  // An R4 placeholder is the ABSENCE of a state, not a variant of one: there is nothing to map it
  // to, and those rows are exactly the ones the maestro's RIF step recovers.
  test.each([['NO IDENTIFICADO'], ['N/A'], ['SIN DEFINIR'], ['-'], ['0'], ['ESTADO']])(
    'the placeholder %s never reaches the queue',
    (crudo) => {
      const cola = createColaAccumulator()
      cola.addEstado(crudo, sinEstado(), 100)
      expect(cola.build()).toEqual([])
    },
  )

  test('an empty crudo produces no item — that is the maestro\'s job, not the cola\'s', () => {
    const cola = createColaAccumulator()
    cola.addEstado('', sinEstado(), 10)
    expect(cola.build()).toEqual([])
  })

  test('rows are grouped by normalized crudo and their TON summed', () => {
    const cola = createColaAccumulator()
    cola.addEstado('zona x', sinEstado(), 3)
    cola.addEstado('ZONA   X', sinEstado(), 4)
    const items = cola.build()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ registrosAfectados: 2, tonAfectadas: 7 })
  })

  test('the two domains coexist and each carries its own dominio', () => {
    const cola = createColaAccumulator()
    cola.addSegmento('TIENDA RARA', sinEstado({ flagRegistro: 'SIN_CLASIFICAR', segmentoN3: null, metodoSegmento: null }), 1)
    cola.addEstado('ZONA X', sinEstado(), 2)
    const dominios = cola.build().map((i) => i.dominio).sort()
    expect(dominios).toEqual(['ESTADO', 'SEGMENTO'])
  })

  // The per-domain cap is what stops a long tail of unresolved segments from pushing every
  // unresolved state out of a globally-capped queue.
  test('the cap applies per domain, not across the whole queue', () => {
    const cola = createColaAccumulator()
    for (let i = 0; i < 10; i++) {
      cola.addSegmento(`SEG ${i}`, sinEstado({ flagRegistro: 'SIN_CLASIFICAR', segmentoN3: null, metodoSegmento: null }), 1000 + i)
    }
    for (let i = 0; i < 10; i++) cola.addEstado(`EST ${i}`, sinEstado(), 1)

    const items = cola.build(3)
    expect(items.filter((i) => i.dominio === 'SEGMENTO')).toHaveLength(3)
    expect(items.filter((i) => i.dominio === 'ESTADO')).toHaveLength(3)
  })
})

describe('applyEstadoRecovery', () => {
  const maestro = (estadoHabitual: string | null): Map<string, MaestroEntry> =>
    new Map([['J1', {
      rif: 'J1', razonSocial: null, segmentoN3: 'BODEGA', macroN1: 'M', metodo: 'MAESTRO',
      confianza: 'N3', estadoHabitual, fechaClasificacion: null, reglaCanonica: 'MODA',
    }]])

  test('moves rows whose RIF has a habitual estado from SIN_ESTADO to RIF', () => {
    const result = applyEstadoRecovery({
      estado: { ...newEstadoTally(), EXACTO: 5, SIN_ESTADO: 4 },
      sinEstadoPorRif: new Map([['J1', 3]]),
      maestro: maestro('ZULIA'),
    })
    expect(result.recuperados).toBe(3)
    expect(result.estado).toMatchObject({ EXACTO: 5, RIF: 3, SIN_ESTADO: 1 })
  })

  test('recovers nothing when the RIF is unknown or has no habitual estado', () => {
    const base = { ...newEstadoTally(), SIN_ESTADO: 4 }
    expect(applyEstadoRecovery({ estado: base, sinEstadoPorRif: new Map([['J9', 3]]), maestro: maestro('ZULIA') }).recuperados).toBe(0)
    expect(applyEstadoRecovery({ estado: base, sinEstadoPorRif: new Map([['J1', 3]]), maestro: maestro(null) }).recuperados).toBe(0)
  })

  test('never mutates its input tally', () => {
    const estado = { ...newEstadoTally(), SIN_ESTADO: 4 }
    applyEstadoRecovery({ estado, sinEstadoPorRif: new Map([['J1', 3]]), maestro: maestro('ZULIA') })
    expect(estado.SIN_ESTADO).toBe(4)
    expect(estado.RIF).toBe(0)
  })
})

describe('metrics — estado buckets', () => {
  // Before this, porMetodoEstado had no FUZZY or DICCIONARIO bucket, so states resolved by those
  // two methods were tallied as SIN_ESTADO — the run under-reported its own state coverage.
  test.each(['EXACTO', 'DICCIONARIO', 'RIF', 'CIUDAD', 'FUZZY'] as const)(
    'a %s-resolved state lands in its own bucket, not SIN_ESTADO',
    (metodo) => {
      const acc = new MetricsAccumulator()
      acc.add('D', row({ metodoEstado: metodo }), 1)
      const totals = acc.totals()
      expect(totals.porMetodoEstado[metodo]).toBe(1)
      expect(totals.porMetodoEstado.SIN_ESTADO).toBe(0)
      expect(totals.estadoValido).toBe(1)
    },
  )

  test('an unresolved state lands in SIN_ESTADO', () => {
    const acc = new MetricsAccumulator()
    acc.add('D', sinEstado(), 1)
    expect(acc.totals().porMetodoEstado.SIN_ESTADO).toBe(1)
    expect(acc.totals().estadoValido).toBe(0)
  })

  test('per-distributor estado tallies are tracked and snapshots are independent copies', () => {
    const acc = new MetricsAccumulator()
    acc.add('D1', row({ metodoEstado: 'DICCIONARIO' }), 1)
    acc.add('D2', sinEstado(), 1)
    const [a, b] = acc.distribuidores().sort((x, y) => x.nombre.localeCompare(y.nombre))
    expect(a.metodoEstado.DICCIONARIO).toBe(1)
    expect(b.metodoEstado.SIN_ESTADO).toBe(1)

    a.metodoEstado.DICCIONARIO = 99
    expect(acc.distribuidores()[0].metodoEstado.DICCIONARIO).not.toBe(99)
  })

  test('estadoExactoCrudo counts only states the distributor already sent canonical', () => {
    const acc = new MetricsAccumulator()
    acc.add('D', row({ metodoEstado: 'EXACTO' }), 1)
    acc.add('D', row({ metodoEstado: 'CIUDAD' }), 1)
    expect(acc.distribuidores()[0].estadoExactoCrudo).toBe(1)
  })
})

describe('mergeEstadoDiccionario', () => {
  const seed = [
    { variante: 'LA GUAIRA', estadoStd: 'VARGAS', activa: true },
    { variante: 'DTTO CAPITAL', estadoStd: 'DISTRITO CAPITAL', activa: true },
  ]

  test('a learned entry replaces the seed entry with the same normalized variante', () => {
    const merged = mergeEstadoDiccionario(seed, [{ variante: 'la  guaira', estadoStd: 'MIRANDA', activa: true }])
    expect(merged.filter((e) => normalizeText(e.variante) === 'LA GUAIRA')).toHaveLength(1)
    expect(merged.find((e) => normalizeText(e.variante) === 'LA GUAIRA')?.estadoStd).toBe('MIRANDA')
  })

  test('untouched seed entries and brand-new learned entries both survive', () => {
    const merged = mergeEstadoDiccionario(seed, [{ variante: 'ZONA X', estadoStd: 'ZULIA', activa: true }])
    expect(merged).toHaveLength(3)
    expect(merged.some((e) => e.variante === 'DTTO CAPITAL')).toBe(true)
    expect(merged.some((e) => e.variante === 'ZONA X')).toBe(true)
  })

  test('an empty learned list returns the seeds unchanged', () => {
    expect(mergeEstadoDiccionario(seed, [])).toEqual(seed)
  })
})

describe('store — estado learning end to end', () => {
  beforeEach(async () => {
    await clearLearned()
    await useStore.getState().refreshLearned()
  })

  test('resolving an ESTADO cola item writes a learned estado variant', async () => {
    useStore.setState({
      cola: [{
        id: 'estado_sin_resolver-zona-x',
        dominio: 'ESTADO',
        tipo: 'ESTADO_SIN_RESOLVER',
        valorCrudo: 'ZONA X',
        registrosAfectados: 4,
        tonAfectadas: 9,
        sugerenciaFuzzy: null,
        resolucion: null,
      }],
    })

    await useStore.getState().resolveColaItem('estado_sin_resolver-zona-x', 'ZULIA')

    expect(await getLearnedEstados()).toEqual([{ variante: 'ZONA X', estadoStd: 'ZULIA', activa: true }])
    expect(useStore.getState().cola[0].resolucion).toBe('ZULIA')
    expect(useStore.getState().learned.estadoDiccionario).toBe(1)
  })

  test('an ESTADO item is rejected when the value is not one of the 24 official estados', async () => {
    useStore.setState({
      cola: [{
        id: 'x', dominio: 'ESTADO', tipo: 'ESTADO_SIN_RESOLVER', valorCrudo: 'ZONA X',
        registrosAfectados: 1, tonAfectadas: 1, sugerenciaFuzzy: null, resolucion: null,
      }],
    })
    await useStore.getState().resolveColaItem('x', 'LA GUAIRA') // a variant, not a catalog name
    expect(await getLearnedEstados()).toEqual([])
    expect(useStore.getState().cola[0].resolucion).toBeNull()
  })

  test('loadRunConfig merges learned estado variants over the seeds', async () => {
    await putLearnedEstado({ variante: 'ZONA X', estadoStd: 'LARA', activa: true })
    const config = await loadRunConfig()
    expect(config.estadoDiccionario).toHaveLength(SEEDS.estadoDiccionario.length + 1)
    expect(config.estadoDiccionario.at(-1)).toEqual({ variante: 'ZONA X', estadoStd: 'LARA', activa: true })
  })

  test('importEstadoDiccionarioCsv accepts valid rows and skips unknown estados', async () => {
    const csv = 'variante,estado_std\nZONA A,ZULIA\nZONA B,NO EXISTE\n,LARA\nZONA C,Mérida\n'
    const file = new File([csv], 'estados.csv', { type: 'text/csv' })
    expect(await useStore.getState().importEstadoDiccionarioCsv(file)).toEqual({ added: 2, skipped: 2 })

    const learned = await getLearnedEstados()
    expect(learned.map((e) => e.estadoStd).sort()).toEqual(['MERIDA', 'ZULIA'])
  })

  test('importEstadoDiccionarioCsv skips everything when the headers are wrong', async () => {
    const file = new File(['a,b\n1,2\n'], 'x.csv', { type: 'text/csv' })
    expect(await useStore.getState().importEstadoDiccionarioCsv(file)).toEqual({ added: 0, skipped: 1 })
  })

  test('resetLearned empties the estado dictionary too', async () => {
    await putLearnedEstado({ variante: 'ZONA X', estadoStd: 'LARA', activa: true })
    await useStore.getState().resetLearned()
    expect(await getLearnedEstados()).toEqual([])
    expect(useStore.getState().learned.estadoDiccionario).toBe(0)
  })
})
