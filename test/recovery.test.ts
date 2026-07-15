import { test, expect, describe } from 'vitest'
import { applyMaestroRecovery } from '@/pipeline/recovery'
import type { MaestroEntry } from '@/contracts/maestro'
import type { MethodTally } from '@/contracts/pipeline'

function maestroEntry(overrides: Partial<MaestroEntry> = {}): MaestroEntry {
  return {
    rif: 'J-1',
    razonSocial: null,
    segmentoN3: 'BODEGA',
    macroN1: 'TRADE TRADICIONAL (UTT)',
    metodo: 'MAESTRO',
    confianza: 'N3',
    estadoHabitual: null,
    fechaClasificacion: null,
    reglaCanonica: 'RECIENTE',
    ...overrides,
  }
}

describe('applyMaestroRecovery', () => {
  test('moves counts from SIN_CLASIFICAR to MAESTRO only for RIFs the maestro knows', () => {
    const segmento: MethodTally = { MAESTRO: 0, EXACTO: 10, FUZZY: 5, SIN_CLASIFICAR: 8 }
    const maestro = new Map([['J1', maestroEntry({ rif: 'J-1' })]])
    const unresueltoPorRif = new Map([
      ['J1', { count: 3, ton: 12, rif: 'J-1', razonSocial: 'Cliente 1', distribuidor: 'DIST_A' }],   // known to the maestro -> recovered
      ['J2', { count: 5, ton: 20, rif: 'J-2', razonSocial: 'Cliente 2', distribuidor: 'DIST_B' }],   // unknown -> stays unresolved
    ])
    const unresueltoDistRif = new Map<string, Map<string, number>>()

    const result = applyMaestroRecovery({
      segmento,
      tonSinClasificar: 32,
      unresueltoPorRif,
      unresueltoDistRif,
      maestro,
    })

    expect(result.segmento).toEqual({ MAESTRO: 3, EXACTO: 10, FUZZY: 5, SIN_CLASIFICAR: 5 })
    expect(result.tonSinClasificar).toBe(20)
    expect(result.recuperados).toBe(3)
    // original tally object is untouched (pure function)
    expect(segmento.SIN_CLASIFICAR).toBe(8)
  })

  test('no RIF in unresueltoPorRif is known to the maestro -> no-op', () => {
    const segmento: MethodTally = { MAESTRO: 0, EXACTO: 10, FUZZY: 0, SIN_CLASIFICAR: 4 }
    const maestro = new Map<string, MaestroEntry>()
    const unresueltoPorRif = new Map([['UNKNOWN', { count: 4, ton: 9, rif: 'UNKNOWN', razonSocial: 'Unknown', distribuidor: 'DIST_C' }]])

    const result = applyMaestroRecovery({
      segmento,
      tonSinClasificar: 9,
      unresueltoPorRif,
      unresueltoDistRif: new Map(),
      maestro,
    })

    expect(result.segmento).toEqual(segmento)
    expect(result.tonSinClasificar).toBe(9)
    expect(result.recuperados).toBe(0)
    expect(result.recuperadosPorDist.size).toBe(0)
  })

  test('per-distributor post rises for recovered RIFs while crudo/exacto stays untouched (D5)', () => {
    // D5 is enforced by construction here: applyMaestroRecovery never looks at exactoCrudo at
    // all, it only produces recuperadosPorDist — the caller adds that to resueltoPost, leaving
    // exactoCrudo/scdcCrudo (computed elsewhere, straight off DistribuidorMetric) untouched.
    const segmento: MethodTally = { MAESTRO: 0, EXACTO: 6, FUZZY: 0, SIN_CLASIFICAR: 6 }
    const maestro = new Map([
      ['J1', maestroEntry({ rif: 'J-1' })],
      ['J2', maestroEntry({ rif: 'J-2' })],
    ])
    const unresueltoPorRif = new Map([
      ['J1', { count: 2, ton: 0, rif: 'J-1', razonSocial: 'Cliente 1', distribuidor: 'DIST_A' }],
      ['J2', { count: 1, ton: 0, rif: 'J-2', razonSocial: 'Cliente 2', distribuidor: 'DIST_B' }],
      ['J3', { count: 3, ton: 0, rif: 'J-3', razonSocial: 'Cliente 3', distribuidor: 'DIST_A' }], // unknown RIF, never recovered
    ])
    const unresueltoDistRif = new Map([
      ['DIST_A', new Map([['J1', 2], ['J3', 3]])],   // 2 recoverable (J1), 3 not (J3)
      ['DIST_B', new Map([['J2', 1]])],              // 1 recoverable
    ])

    const result = applyMaestroRecovery({
      segmento,
      tonSinClasificar: 0,
      unresueltoPorRif,
      unresueltoDistRif,
      maestro,
    })

    expect(result.recuperadosPorDist.get('DIST_A')).toBe(2)
    expect(result.recuperadosPorDist.get('DIST_B')).toBe(1)
    expect(result.recuperados).toBe(3) // 2 (J1) + 1 (J2), J3 never counted
  })

  test('a distributor with zero recoverable rows is absent from recuperadosPorDist', () => {
    const segmento: MethodTally = { MAESTRO: 0, EXACTO: 1, FUZZY: 0, SIN_CLASIFICAR: 1 }
    const maestro = new Map<string, MaestroEntry>()
    const unresueltoDistRif = new Map([['DIST_C', new Map([['UNKNOWN', 1]])]])

    const result = applyMaestroRecovery({
      segmento,
      tonSinClasificar: 0,
      unresueltoPorRif: new Map(),
      unresueltoDistRif,
      maestro,
    })

    expect(result.recuperadosPorDist.has('DIST_C')).toBe(false)
  })
})
