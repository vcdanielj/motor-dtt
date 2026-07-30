import { test, expect, describe } from 'vitest'
import { SEEDS } from '@/seeds'
import {
  buildEstadoContext, cleanEstadoString, resolveEstado, isProhibitedEstado, type EstadoContext,
} from '@/pipeline/estado'
import { normalizeRif, normalizeText } from '@/ingest/normalize'

function makeCtx(): EstadoContext {
  return buildEstadoContext(
    SEEDS.estados, SEEDS.ciudadEstado, new Map([['J-9', 'MERIDA']]), SEEDS.estadoDiccionario,
  )
}

/** Context with no variant dictionary — isolates the catalog/ciudad/RIF steps. */
function makeCtxSinDiccionario(): EstadoContext {
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

  // The input is expected to be already normalized — note '-'/'_'/'|' all arrive as '/'.
  test.each([
    ['N / A'], ['NA'], ['ND'], ['SIN ESTADO'], ['SIN DEFINIR'], ['POR DEFINIR'],
    ['NULL'], ['NINGUNO'], ['DESCONOCIDO'], ['/'], ['0'], ['X'], ['NO APLICA'],
  ])('placeholder %s is prohibited', (value) => {
    expect(isProhibitedEstado(value)).toBe(true)
  })

  test.each([['-'], ['--'], ['_'], ['|'], ['N/A'], ['n/a']])(
    'the raw cell %s normalizes into a prohibited token',
    (raw) => {
      expect(isProhibitedEstado(normalizeText(raw))).toBe(true)
    },
  )
})

describe('cleanEstadoString', () => {
  test.each([
    ['EDO. ZULIA', 'ZULIA'],
    ['EDO.MIRANDA', 'MIRANDA'],          // no space after the period
    ['EDO-MIRANDA', 'MIRANDA'],          // hyphen normalizes to ' / '
    ['ESTADO DE ARAGUA', 'ARAGUA'],
    ['ESTADOS DE ARAGUA', 'ARAGUA'],
    ['ESTADO DEL ZULIA', 'ZULIA'],
    ['13 ZULIA', 'ZULIA'],               // leading sheet code
    ['13 - ZULIA', 'ZULIA'],
    ['MIRANDA ESTADO', 'MIRANDA'],       // trailing noise
    ['ZULIA / VENEZUELA', 'ZULIA'],
    ['LARA VZLA', 'LARA'],
    ['ZULIA (OCCIDENTE)', 'ZULIA'],      // parenthetical
    ['  zulia  ', 'ZULIA'],
  ])('cleans %s to %s', (input, expected) => {
    expect(cleanEstadoString(input)).toBe(expected)
  })

  test('a bare ESTADO collapses to empty, which isProhibitedEstado then rejects', () => {
    expect(cleanEstadoString('ESTADO')).toBe('')
    expect(isProhibitedEstado(cleanEstadoString('ESTADO'))).toBe(true)
  })

  test('does not mangle DISTRITO CAPITAL or DELTA AMACURO', () => {
    expect(cleanEstadoString('Distrito Capital')).toBe('DISTRITO CAPITAL')
    expect(cleanEstadoString('Delta Amacuro')).toBe('DELTA AMACURO')
  })
})

describe('resolveEstado — CATALOGO (EXACTO)', () => {
  test('estadoCrudo "Zulia" resolves EXACTO to ZULIA', () => {
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'Zulia' }, makeCtx())
    expect(result).toMatchObject({ estadoStd: 'ZULIA', metodo: 'EXACTO', flag: 'OK' })
  })

  test('estadoCrudo "Distrito Capital" resolves EXACTO to DISTRITO CAPITAL', () => {
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'Distrito Capital' }, makeCtx())
    expect(result).toMatchObject({ estadoStd: 'DISTRITO CAPITAL', metodo: 'EXACTO', flag: 'OK' })
  })
})

describe('resolveEstado — DICCIONARIO', () => {
  test.each([
    ['DTTO CAPITAL', 'DISTRITO CAPITAL'],
    ['Distrito Federal', 'DISTRITO CAPITAL'],
    ['LA GUAIRA', 'VARGAS'],            // official rename maps back to the catalog name
    ['NVA ESPARTA', 'NUEVA ESPARTA'],
    ['ANSOATEGUI', 'ANZOATEGUI'],
  ])('variant %s resolves via DICCIONARIO to %s', (crudo, esperado) => {
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: crudo }, makeCtx())
    expect(result).toMatchObject({ estadoStd: esperado, metodo: 'DICCIONARIO', flag: 'OK' })
  })

  test('the prefix cleaner and the dictionary compose: "EDO. LA GUAIRA" → VARGAS', () => {
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'EDO. LA GUAIRA' }, makeCtx())
    expect(result).toMatchObject({ estadoStd: 'VARGAS', metodo: 'DICCIONARIO', flag: 'OK' })
  })

  test('a learned entry overrides a seed entry for the same normalized variante', () => {
    const ctx = buildEstadoContext(SEEDS.estados, {}, new Map(), [
      { variante: 'la guaira', estadoStd: 'MIRANDA', activa: true },   // learned wins (first)
      { variante: 'LA GUAIRA', estadoStd: 'VARGAS', activa: true },
    ])
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'LA GUAIRA' }, ctx)
    expect(result).toMatchObject({ estadoStd: 'MIRANDA', metodo: 'DICCIONARIO' })
  })

  test('an inactive entry is ignored', () => {
    const ctx = buildEstadoContext(SEEDS.estados, {}, new Map(), [
      { variante: 'ZONA X', estadoStd: 'ZULIA', activa: false },
    ])
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'ZONA X' }, ctx).flag).toBe('SIN_ESTADO')
  })

  test('the catalog wins over a dictionary entry that would remap a canonical estado', () => {
    const ctx = buildEstadoContext(SEEDS.estados, {}, new Map(), [
      { variante: 'ZULIA', estadoStd: 'MIRANDA', activa: true },
    ])
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'ZULIA' }, ctx))
      .toMatchObject({ estadoStd: 'ZULIA', metodo: 'EXACTO' })
  })
})

describe('resolveEstado — cascade precedence', () => {
  test('DICCIONARIO beats RIF: a written, mappable state outranks the habitual one', () => {
    const result = resolveEstado({ rif: 'J-9', ciudad: null, estadoCrudo: 'DTTO CAPITAL' }, makeCtx())
    expect(result).toMatchObject({ estadoStd: 'DISTRITO CAPITAL', metodo: 'DICCIONARIO' })
  })

  test('RIF beats CIUDAD (R4)', () => {
    const result = resolveEstado(
      { rif: 'J-9', ciudad: 'MARACAIBO', estadoCrudo: 'NO IDENTIFICADO' }, makeCtx(),
    )
    expect(result).toMatchObject({ estadoStd: 'MERIDA', metodo: 'RIF', flag: 'OK' })
  })

  test('"NO IDENTIFICADO" with a resolvable ciudad recovers via CIUDAD, not CATALOGO', () => {
    const result = resolveEstado(
      { rif: null, ciudad: 'Maracaibo', estadoCrudo: 'NO IDENTIFICADO' }, makeCtx(),
    )
    expect(result).toMatchObject({ estadoStd: 'ZULIA', metodo: 'CIUDAD', flag: 'OK' })
  })

  test('ciudad "MARACAIBO" with no usable estadoCrudo resolves via CIUDAD to ZULIA', () => {
    const result = resolveEstado({ rif: null, ciudad: 'MARACAIBO', estadoCrudo: '' }, makeCtx())
    expect(result).toMatchObject({ estadoStd: 'ZULIA', metodo: 'CIUDAD', flag: 'OK' })
  })
})

describe('resolveEstado — FUZZY and the suggestion band', () => {
  test('a near-miss above the threshold resolves FUZZY', () => {
    const ctx = makeCtx()
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'DISTRITO CAPITALL' }, ctx))
      .toMatchObject({ estadoStd: 'DISTRITO CAPITAL', metodo: 'FUZZY', flag: 'OK' })
  })

  // At the shared 92 threshold a single typo in a short state name scores in the 80s, so it lands
  // in the suggestion band rather than being auto-assigned. That is the intended trade: the motor
  // stops guessing at estados and routes the value to the cola, where one click teaches it for
  // good. The seeded variant dictionary already covers the habitual misspellings.
  test('a match in the [floor, threshold) band suggests instead of assigning', () => {
    const ctx = makeCtxSinDiccionario()
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'ANZOATEGI' }, ctx)
    expect(result.flag).toBe('SIN_ESTADO')
    expect(result.estadoStd).toBeNull()
    expect(result.sugerencia).toEqual({ estadoStd: 'ANZOATEGUI', score: 90 })
  })

  test('a lowered threshold turns that same suggestion into an assignment', () => {
    const ctx = buildEstadoContext(SEEDS.estados, {}, new Map(), [], 80, 70)
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'ANZOATEGI' }, ctx))
      .toMatchObject({ estadoStd: 'ANZOATEGUI', metodo: 'FUZZY', flag: 'OK' })
  })

  test('a fuzzy hit on a DICTIONARY key resolves to that key\'s canonical estado', () => {
    const ctx = buildEstadoContext(SEEDS.estados, {}, new Map(), [
      { variante: 'ZONA METROPOLITANA', estadoStd: 'DISTRITO CAPITAL', activa: true },
    ], 85, 70)
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'ZONA METROPOLITAN' }, ctx))
      .toMatchObject({ estadoStd: 'DISTRITO CAPITAL', metodo: 'FUZZY' })
  })

  test('a far-off value stays unresolved with no suggestion', () => {
    const result = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'ZONA COMERCIAL 4' }, makeCtx())
    expect(result.flag).toBe('SIN_ESTADO')
    expect(result.sugerencia).toBeNull()
  })
})

describe('resolveEstado — SIN_ESTADO', () => {
  test('unresolvable ciudad and prohibited estadoCrudo yields SIN_ESTADO', () => {
    const result = resolveEstado(
      { rif: null, ciudad: 'CIUDAD INEXISTENTE XZ', estadoCrudo: 'NO IDENTIFICADO' }, makeCtx(),
    )
    expect(result).toMatchObject({ estadoStd: null, metodo: null, flag: 'SIN_ESTADO' })
  })

  test('all-empty input yields SIN_ESTADO without throwing', () => {
    const ctx = makeCtx()
    expect(() => resolveEstado({ rif: null, ciudad: null, estadoCrudo: null }, ctx)).not.toThrow()
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: null }, ctx))
      .toMatchObject({ estadoStd: null, metodo: null, flag: 'SIN_ESTADO' })
  })
})

describe('buildEstadoContext', () => {
  test('normalizes the catalog into a 24-entry set', () => {
    const ctx = makeCtx()
    expect(ctx.catalogo.size).toBe(24)
    expect(ctx.catalogo.has('ZULIA')).toBe(true)
  })

  test('normalizes ciudadEstado keys via normalizeText', () => {
    expect(makeCtx().ciudadEstado.get('MARACAIBO')).toBe('ZULIA')
  })

  test('carries through the provided estadoByRif map, keyed by normalizeRif(rif)', () => {
    expect(makeCtx().estadoByRif.get(normalizeRif('J-9'))).toBe('MERIDA')
  })

  test('defaults estadoByRif, the dictionary and the thresholds when omitted', () => {
    const ctx = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)
    expect(ctx.estadoByRif.size).toBe(0)
    expect(ctx.index.keys).toHaveLength(0)
    expect(ctx.fuzzyThreshold).toBe(92)
    expect(ctx.fuzzySuggestFloor).toBe(80)
  })
})

describe('resolveEstado — normalizeRif key robustness', () => {
  test('two raw RIF formats for the same estadoByRif entry both resolve to it', () => {
    const ctx = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado, new Map([['J-500522657', 'MERIDA']]))
    expect(resolveEstado({ rif: 'J-500522657', ciudad: null, estadoCrudo: null }, ctx))
      .toMatchObject({ estadoStd: 'MERIDA', metodo: 'RIF', flag: 'OK' })
    expect(resolveEstado({ rif: 'J500522657', ciudad: null, estadoCrudo: null }, ctx))
      .toMatchObject({ estadoStd: 'MERIDA', metodo: 'RIF', flag: 'OK' })
  })
})

describe('resolveEstado — prefix stripping still resolves EXACTO', () => {
  test.each([
    ['EDO. ZULIA', 'ZULIA'],
    ['ESTADO MIRANDA', 'MIRANDA'],
    ['ESTADO DE ARAGUA', 'ARAGUA'],
    ['13 LARA', 'LARA'],
  ])('%s → %s', (crudo, esperado) => {
    expect(resolveEstado({ rif: null, ciudad: null, estadoCrudo: crudo }, makeCtx()))
      .toMatchObject({ estadoStd: esperado, metodo: 'EXACTO', flag: 'OK' })
  })
})
