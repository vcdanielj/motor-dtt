import { describe, it, expect } from 'vitest'
import { SEEDS } from '@/seeds'

describe('seeds', () => {
  it('35 N3 segments seeded', () => {
    expect(SEEDS.segmentos).toHaveLength(35)
  })

  it('every segment macro is non-empty and consistent', () => {
    const macros = new Set(SEEDS.segmentos.map((s) => s.macroN1))
    expect([...macros].every((m) => m.length > 0)).toBe(true)
    expect(macros.size).toBeGreaterThanOrEqual(7)
  })

  it('every diccionario N3 exists in the segment catalog', () => {
    const n3 = new Set(SEEDS.segmentos.map((s) => s.n3))
    for (const d of SEEDS.diccionario) expect(n3.has(d.segmentoN3)).toBe(true)
  })

  it('24 estados seeded', () => {
    expect(SEEDS.estados).toHaveLength(24)
  })

  it('seeds are flagged placeholder', () => {
    expect(SEEDS.provenance.placeholder).toBe(true)
  })
})
