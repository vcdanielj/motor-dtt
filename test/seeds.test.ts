import { describe, it, expect } from 'vitest'
import { SEEDS, SEGMENTOS } from '@/seeds'

describe('seeds', () => {
  it('37 N3 segments seeded', () => {
    expect(SEEDS.segmentos).toHaveLength(37)
  })

  it('every segment macro is non-empty and there are exactly 8, including TIENDAS ESPECIALIZADAS', () => {
    const macros = new Set(SEEDS.segmentos.map((s) => s.macroN1))
    expect([...macros].every((m) => m.length > 0)).toBe(true)
    expect(macros.size).toBe(8)
    expect(macros.has('TIENDAS ESPECIALIZADAS')).toBe(true)
  })

  it('every segment has a non-empty codigo', () => {
    expect(SEGMENTOS.every((s) => typeof s.codigo === 'string' && s.codigo.length > 0)).toBe(true)
  })

  it('every diccionario N3 exists in the segment catalog', () => {
    const n3 = new Set(SEEDS.segmentos.map((s) => s.n3))
    for (const d of SEEDS.diccionario) expect(n3.has(d.segmentoN3)).toBe(true)
  })

  it('every diccionario codigo matches its segment codigo (referential integrity)', () => {
    const bySegN3 = new Map(SEEDS.segmentos.map((s) => [s.n3, s.codigo]))
    for (const d of SEEDS.diccionario) expect(d.codigo).toBe(bySegN3.get(d.segmentoN3))
  })

  it('24 estados seeded, using VARGAS not LA GUAIRA', () => {
    expect(SEEDS.estados).toHaveLength(24)
    expect(SEEDS.estados.includes('VARGAS')).toBe(true)
    expect(SEEDS.estados.includes('LA GUAIRA')).toBe(false)
  })

  it('seeds are the official catalog, not placeholder', () => {
    expect(SEEDS.provenance.placeholder).toBe(false)
  })
})
