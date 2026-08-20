import { describe, it, expect } from 'vitest'
import { normalizeText } from '@/ingest/normalize'
import { SEEDS, SEGMENTOS } from '@/seeds'

describe('seeds', () => {
  it('exactly the 14 official CEC segments, verbatim', () => {
    expect(SEEDS.segmentos.map((s) => s.n3)).toEqual([
      'Abastos',
      'Bodegas',
      'Bodegones',
      'Carniceria, charcuteria y Frigorifico',
      'Farmacias',
      'Horeca',
      'Kioscos',
      'Licorerias y Bares',
      'Mayoristas',
      'Otros',
      'Panaderias y Pastelerias',
      'SMI',
      'SMI - Mini Market',
      'Tiendas de conveniencias',
    ])
  })

  it('every segment macro is non-empty and Otros is a segment per se', () => {
    const macros = new Set(SEEDS.segmentos.map((s) => s.macroN1))
    expect([...macros].every((m) => m.length > 0)).toBe(true)
    expect(SEEDS.segmentos.some((s) => s.n3 === 'Otros')).toBe(true)
  })

  it('no two segments share a codigo and no two N3 collide after normalization', () => {
    expect(new Set(SEEDS.segmentos.map((s) => s.codigo)).size).toBe(14)
    expect(new Set(SEEDS.segmentos.map((s) => normalizeText(s.n3))).size).toBe(14)
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


  it('every estado diccionario variant maps to a real catalog estado', () => {
    const catalogo = new Set(SEEDS.estados)
    for (const e of SEEDS.estadoDiccionario) {
      expect(catalogo.has(e.estadoStd), `${e.variante} -> ${e.estadoStd}`).toBe(true)
    }
  })

  it('no estado variant normalizes to a catalog name (that would be a no-op entry)', () => {
    const catalogo = new Set(SEEDS.estados.map(normalizeText))
    for (const e of SEEDS.estadoDiccionario) {
      expect(catalogo.has(normalizeText(e.variante)), e.variante).toBe(false)
    }
  })

  it('estado variants are unique once normalized', () => {
    const seen = new Set<string>()
    for (const e of SEEDS.estadoDiccionario) {
      const key = normalizeText(e.variante)
      expect(seen.has(key), `duplicada: ${e.variante}`).toBe(false)
      seen.add(key)
    }
  })

  it('LA GUAIRA is modelled as a variant of VARGAS, keeping the catalog authoritative', () => {
    const entry = SEEDS.estadoDiccionario.find((e) => normalizeText(e.variante) === 'LA GUAIRA')
    expect(entry?.estadoStd).toBe('VARGAS')
  })

  it('every ciudad_estado value is a real catalog estado', () => {
    const catalogo = new Set(SEEDS.estados)
    for (const [ciudad, estado] of Object.entries(SEEDS.ciudadEstado)) {
      expect(catalogo.has(estado), `${ciudad} -> ${estado}`).toBe(true)
    }
  })

  it('ciudad_estado covers all 24 estados', () => {
    const cubiertos = new Set(Object.values(SEEDS.ciudadEstado))
    for (const estado of SEEDS.estados) expect(cubiertos.has(estado), estado).toBe(true)
  })

  it('seeds are the official catalog, not placeholder', () => {
    expect(SEEDS.provenance.placeholder).toBe(false)
  })
})

describe('ciudad_estado — reglas de inclusión', () => {
  it('no contiene topónimos que se repiten en varios estados', () => {
    // Cada uno de estos nombra lugares en más de un estado; mapearlos sería adivinar.
    const ambiguos = ['SAN CARLOS', 'LIBERTADOR', 'BOLIVAR', 'LA VICTORIA', 'INDEPENDENCIA',
      'LAGUNILLAS', 'SANTA RITA', 'LA CONCEPCION', 'SABANETA', 'LA CANDELARIA', 'SAN MATEO',
      'MONTALBAN', 'ALTAGRACIA', 'COCHE', 'EL VALLE']
    const claves = new Set(Object.keys(SEEDS.ciudadEstado).map(normalizeText))
    for (const a of ambiguos) expect(claves.has(a), a).toBe(false)
  })

  it('los municipios del área metropolitana caraqueña quedan en su estado real', () => {
    // Baruta, Chacao, El Hatillo y Sucre (Petare) son MIRANDA, no Distrito Capital, por más que
    // comercialmente se hable de «Gran Caracas». Verificado contra el archivo real de Heinz.
    for (const c of ['BARUTA', 'CHACAO', 'EL HATILLO', 'PETARE']) {
      expect(SEEDS.ciudadEstado[c], c).toBe('MIRANDA')
    }
    // Las parroquias del municipio Libertador sí son Distrito Capital.
    for (const c of ['CATIA', 'EL JUNQUITO', 'ANTIMANO', 'CARICUAO']) {
      expect(SEEDS.ciudadEstado[c], c).toBe('DISTRITO CAPITAL')
    }
  })
})
