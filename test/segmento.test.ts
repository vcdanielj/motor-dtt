import { test, expect, describe } from 'vitest'
import { SEEDS } from '@/seeds'
import { buildIndex, buildMaestro, resolveSegmento, type SegmentoContext } from '@/pipeline/segmento'
import type { MaestroEntry } from '@/contracts/maestro'

function makeCtx(maestroEntries: MaestroEntry[] = []): SegmentoContext {
  return {
    index: buildIndex(SEEDS.diccionario),
    maestro: buildMaestro(maestroEntries),
    fuzzyThreshold: 92,
    fuzzySuggestFloor: 80,
  }
}

describe('buildIndex — real 202-variant catalog integrity', () => {
  test('indexes more than 150 active entries and every key round-trips through normalizeText', async () => {
    const { normalizeText } = await import('@/ingest/normalize')
    const idx = buildIndex(SEEDS.diccionario)
    expect(idx.byKey.size).toBeGreaterThan(150)
    for (const key of idx.keys) {
      const entry = idx.byKey.get(key)
      expect(entry).toBeDefined()
      expect(normalizeText(entry!.variante)).toBe(key)
    }
  })
})

describe('resolveSegmento — EXACTO', () => {
  test('crudo "Bodegas" resolves EXACTO to BODEGA', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: 'Bodegas' }, ctx)
    expect(result.segmentoN3).toBe('BODEGA')
    expect(result.metodo).toBe('EXACTO')
    expect(result.confianza).toBe('N3')
    expect(result.flag).toBe('OK')
    expect(result.fuzzyScore).toBeNull()
    expect(result.sugerencia).toBeNull()
  })

  test('crudo "PANADERIA/PASTELERIA" resolves EXACTO to PANADERIA', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: 'PANADERIA/PASTELERIA' }, ctx)
    expect(result.segmentoN3).toBe('PANADERIA')
    expect(result.metodo).toBe('EXACTO')
    expect(result.flag).toBe('OK')
  })

  test('crudo "MINIMARKETS" resolves EXACTO to MINI MARKET', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: 'MINIMARKETS' }, ctx)
    expect(result.segmentoN3).toBe('MINI MARKET')
    expect(result.metodo).toBe('EXACTO')
    expect(result.flag).toBe('OK')
  })
})

describe('resolveSegmento — MAESTRO precedence', () => {
  test('MAESTRO hit by RIF wins over an EXACTO-matching crudo', () => {
    const maestroEntries: MaestroEntry[] = [{
      rif: 'J-123',
      razonSocial: 'Cliente Test',
      segmentoN3: 'BODEGON',
      macroN1: 'BODEGONES',
      metodo: 'MANUAL',
      confianza: 'N3',
      estadoHabitual: null,
      fechaClasificacion: null,
      reglaCanonica: 'MANUAL',
    }]
    const ctx = makeCtx(maestroEntries)
    // 'ABASTOS' would resolve EXACTO to ABASTO if maestro were absent — maestro must win.
    const result = resolveSegmento({ rif: 'J-123', crudo: 'ABASTOS' }, ctx)
    expect(result.segmentoN3).toBe('BODEGON')
    expect(result.macroN1).toBe('BODEGONES')
    expect(result.metodo).toBe('MAESTRO')
    expect(result.confianza).toBe('N3')
    expect(result.flag).toBe('OK')
  })

  test('MAESTRO hit wins even without any crudo', () => {
    const maestroEntries: MaestroEntry[] = [{
      rif: 'J-999',
      razonSocial: 'Cliente Sin Crudo',
      segmentoN3: 'FARMACIA',
      macroN1: 'FARMACIAS',
      metodo: 'MANUAL',
      confianza: null,
      estadoHabitual: null,
      fechaClasificacion: null,
      reglaCanonica: 'MANUAL',
    }]
    const ctx = makeCtx(maestroEntries)
    const result = resolveSegmento({ rif: 'J-999', crudo: null }, ctx)
    expect(result.segmentoN3).toBe('FARMACIA')
    expect(result.metodo).toBe('MAESTRO')
    // confianza was null on the maestro entry but it has an n3 -> treated as 'N3'
    expect(result.confianza).toBe('N3')
    expect(result.flag).toBe('OK')
  })

  test('a null-confianza maestro entry with no n3 is treated as MACRO', () => {
    const maestroEntries: MaestroEntry[] = [{
      rif: 'J-777',
      razonSocial: 'Cliente Solo Macro',
      segmentoN3: null,
      macroN1: 'BODEGONES',
      metodo: 'MANUAL',
      confianza: null,
      estadoHabitual: null,
      fechaClasificacion: null,
      reglaCanonica: 'MANUAL',
    }]
    const ctx = makeCtx(maestroEntries)
    const result = resolveSegmento({ rif: 'J-777', crudo: null }, ctx)
    expect(result.macroN1).toBe('BODEGONES')
    expect(result.metodo).toBe('MAESTRO')
    expect(result.confianza).toBe('MACRO')
  })
})

describe('resolveSegmento — normalizeRif key robustness', () => {
  test('two raw RIF formats for the same maestro entry both resolve to it', () => {
    const maestroEntries: MaestroEntry[] = [{
      rif: 'J-500522657',
      razonSocial: 'Cliente RIF Robusto',
      segmentoN3: 'FARMACIA',
      macroN1: 'FARMACIAS',
      metodo: 'MANUAL',
      confianza: 'N3',
      estadoHabitual: null,
      fechaClasificacion: null,
      reglaCanonica: 'MANUAL',
    }]
    const ctx = makeCtx(maestroEntries)
    const withDashes = resolveSegmento({ rif: 'J-500522657', crudo: null }, ctx)
    const bare = resolveSegmento({ rif: 'J500522657', crudo: null }, ctx)
    expect(withDashes.metodo).toBe('MAESTRO')
    expect(bare.metodo).toBe('MAESTRO')
    expect(withDashes.segmentoN3).toBe('FARMACIA')
    expect(bare.segmentoN3).toBe('FARMACIA')
    expect(withDashes).toEqual(bare)
  })
})

describe('resolveSegmento — FUZZY (>=92)', () => {
  // Empirically verified: normalizeText('Supermercado Grandes') === 'SUPERMERCADO GRANDES',
  // which is NOT an exact dictionary key. bestMatch(key, ctx.index.keys) scores it 95
  // against the real variant 'SUPERMERCADO GRANDE' (segmentoN3 'SUPERMERCADO INDEPENDIENTE GRANDE').
  test('a near-miss plural of a real variant scores >=92 and resolves FUZZY', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: 'Supermercado Grandes' }, ctx)
    expect(result.metodo).toBe('FUZZY')
    expect(result.segmentoN3).toBe('SUPERMERCADO INDEPENDIENTE GRANDE')
    expect(result.macroN1).toBe('SUPERMERCADOS INDEPENDIENTES')
    expect(result.confianza).toBe('N3')
    expect(result.fuzzyScore).not.toBeNull()
    expect(result.fuzzyScore as number).toBeGreaterThanOrEqual(92)
    expect(result.fuzzyScore).toBe(95)
    expect(result.flag).toBe('OK')
    expect(result.sugerencia).toBeNull()
  })
})

describe('resolveSegmento — suggestion band (80-91)', () => {
  // Empirically verified: normalizeText('MINIMARKTS') === 'MINIMARKTS' (distinct from the real
  // key 'MINIMARTS'), and bestMatch scores it 91 against the real variant 'MINIMARKETS'
  // (segmentoN3 'MINI MARKET') — squarely inside [80,92).
  test('a near-miss that scores 80-91 lands in SIN_CLASIFICAR with a cola suggestion', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: 'MINIMARKTS' }, ctx)
    expect(result.flag).toBe('SIN_CLASIFICAR')
    expect(result.metodo).toBeNull()
    expect(result.confianza).toBeNull()
    expect(result.segmentoN3).toBeNull()
    expect(result.macroN1).toBeNull()
    expect(result.fuzzyScore).toBe(91)
    expect(result.sugerencia).not.toBeNull()
    expect(result.sugerencia?.segmentoN3).toBe('MINI MARKET')
    expect(result.sugerencia?.macroN1).toBe('SUPERMERCADOS INDEPENDIENTES')
    expect(result.sugerencia?.score).toBe(91)
    expect(result.sugerencia!.score).toBeGreaterThanOrEqual(80)
    expect(result.sugerencia!.score).toBeLessThan(92)
  })
})

describe('resolveSegmento — SIN_CLASIFICAR', () => {
  test('a nonsense crudo with no plausible match resolves SIN_CLASIFICAR', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: 'ZZZ NEGOCIO RARO 12345' }, ctx)
    expect(result.flag).toBe('SIN_CLASIFICAR')
    expect(result.metodo).toBeNull()
    expect(result.confianza).toBeNull()
    expect(result.segmentoN3).toBeNull()
    expect(result.macroN1).toBeNull()
    expect(result.sugerencia).toBeNull()
  })
})

describe('resolveSegmento — empty/null inputs never throw', () => {
  test('empty crudo string', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: '' }, ctx)
    expect(result.flag).toBe('SIN_CLASIFICAR')
    expect(result.metodo).toBeNull()
    expect(result.sugerencia).toBeNull()
  })

  test('null crudo', () => {
    const ctx = makeCtx()
    const result = resolveSegmento({ rif: null, crudo: null }, ctx)
    expect(result.flag).toBe('SIN_CLASIFICAR')
    expect(result.metodo).toBeNull()
  })

  test('null rif and null crudo together', () => {
    const ctx = makeCtx()
    expect(() => resolveSegmento({ rif: null, crudo: null }, ctx)).not.toThrow()
  })
})
