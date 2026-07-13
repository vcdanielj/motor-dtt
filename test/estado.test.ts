import { test, expect, describe } from 'vitest'
import { SEEDS } from '@/seeds'
import { buildEstadoContext, resolveEstado, isProhibitedEstado, type EstadoContext } from '@/pipeline/estado'
import { normalizeRif } from '@/ingest/normalize'

function makeCtx(): EstadoContext {
  return buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado, new Map([['J-9', 'MERIDA']]))
}

describe('isProhibitedEstado', () => {
  test('NO IDENTIFICADO is prohibited', () => {
    expect(isProhibitedEstado('NO IDENTIFICADO')).toBe(true)
  })

  test('empty string is prohibited', () => {
    expect(isProhibitedEstado('')).toBe(true)
  })

  test('a real estado is not prohibited', () => {
    expect(isProhibitedEstado('ZULIA')).toBe(false)
  })
})

describe('resolveEstado — CATALOGO (EXACTO)', () => {
  test('estadoCrudo "Zulia" resolves EXACTO to ZULIA', () => {
    const ctx = makeCtx()
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'Zulia' }, ctx)
    expect(result).toEqual({ estadoStd: 'ZULIA', metodo: 'EXACTO', flag: 'OK' })
  })

  test('estadoCrudo "Distrito Capital" resolves EXACTO to DISTRITO CAPITAL', () => {
    const ctx = makeCtx()
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'Distrito Capital' }, ctx)
    expect(result).toEqual({ estadoStd: 'DISTRITO CAPITAL', metodo: 'EXACTO', flag: 'OK' })
  })
})

describe('resolveEstado — R4 NO IDENTIFICADO is treated as null (not matched)', () => {
  test('"NO IDENTIFICADO" with a resolvable ciudad recovers via CIUDAD, not CATALOGO', () => {
    const ctx = makeCtx()
    const result = resolveEstado({ rif: null, ciudad: 'Maracaibo', estadoCrudo: 'NO IDENTIFICADO' }, ctx)
    expect(result).toEqual({ estadoStd: 'ZULIA', metodo: 'CIUDAD', flag: 'OK' })
  })
})

describe('resolveEstado — CIUDAD', () => {
  test('ciudad "MARACAIBO" with no usable estadoCrudo resolves via CIUDAD to ZULIA', () => {
    const ctx = makeCtx()
    const result = resolveEstado({ rif: null, ciudad: 'MARACAIBO', estadoCrudo: '' }, ctx)
    expect(result).toEqual({ estadoStd: 'ZULIA', metodo: 'CIUDAD', flag: 'OK' })
  })
})

describe('resolveEstado — RIF beats CIUDAD (R4 precedence)', () => {
  test('RIF map says MERIDA while ciudad says ZULIA; RIF wins', () => {
    const ctx = makeCtx()
    const result = resolveEstado(
      { rif: 'J-9', ciudad: 'MARACAIBO', estadoCrudo: 'NO IDENTIFICADO' },
      ctx,
    )
    expect(result).toEqual({ estadoStd: 'MERIDA', metodo: 'RIF', flag: 'OK' })
  })
})

describe('resolveEstado — SIN_ESTADO', () => {
  test('unresolvable ciudad and prohibited estadoCrudo yields SIN_ESTADO', () => {
    const ctx = makeCtx()
    const result = resolveEstado(
      { rif: null, ciudad: 'CIUDAD INEXISTENTE XZ', estadoCrudo: 'NO IDENTIFICADO' },
      ctx,
    )
    expect(result).toEqual({ estadoStd: null, metodo: null, flag: 'SIN_ESTADO' })
  })

  test('all-empty input yields SIN_ESTADO without throwing', () => {
    const ctx = makeCtx()
    expect(() => resolveEstado({ rif: null, ciudad: null, estadoCrudo: null }, ctx)).not.toThrow()
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: null }, ctx)
    expect(result).toEqual({ estadoStd: null, metodo: null, flag: 'SIN_ESTADO' })
  })
})

describe('buildEstadoContext', () => {
  test('normalizes the catalog into a 24-entry set', () => {
    const ctx = makeCtx()
    expect(ctx.catalogo.size).toBe(24)
    expect(ctx.catalogo.has('ZULIA')).toBe(true)
  })

  test('normalizes ciudadEstado keys via normalizeText', () => {
    const ctx = makeCtx()
    expect(ctx.ciudadEstado.get('MARACAIBO')).toBe('ZULIA')
  })

  test('carries through the provided estadoByRif map, keyed by normalizeRif(rif)', () => {
    const ctx = makeCtx()
    expect(ctx.estadoByRif.get(normalizeRif('J-9'))).toBe('MERIDA')
  })

  test('defaults estadoByRif to an empty map when omitted', () => {
    const ctx = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)
    expect(ctx.estadoByRif.size).toBe(0)
  })
})

describe('resolveEstado — normalizeRif key robustness', () => {
  test('two raw RIF formats for the same estadoByRif entry both resolve to it', () => {
    const ctx = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado, new Map([['J-500522657', 'MERIDA']]))
    const withDashes = resolveEstado({ rif: 'J-500522657', ciudad: null, estadoCrudo: null }, ctx)
    const bare = resolveEstado({ rif: 'J500522657', ciudad: null, estadoCrudo: null }, ctx)
    expect(withDashes).toEqual({ estadoStd: 'MERIDA', metodo: 'RIF', flag: 'OK' })
    expect(bare).toEqual({ estadoStd: 'MERIDA', metodo: 'RIF', flag: 'OK' })
  })
})
