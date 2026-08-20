import { test, expect, describe } from 'vitest'
import { MaestroBuilder, parseFechaOrden } from '@/pipeline/maestro'
import { normalizeRif } from '@/ingest/normalize'

const UTT = 'TRADE TRADICIONAL (UTT)'
const MAYORISTAS = 'MAYORISTAS'

describe('parseFechaOrden', () => {
  test('Spanish/English 3-letter month + 2-digit year (Oct/25 -> 202510)', () => {
    expect(parseFechaOrden('Oct/25')).toBe(202510)
  })

  test('Mar/26 -> 202603', () => {
    expect(parseFechaOrden('Mar/26')).toBe(202603)
  })

  test('all-caps Spanish month with dash separator: DIC/24 -> 202412', () => {
    expect(parseFechaOrden('DIC/24')).toBe(202412)
  })

  test('ISO-ish YYYY-MM: 2025-11 -> 202511', () => {
    expect(parseFechaOrden('2025-11')).toBe(202511)
  })

  test('MM/YYYY is also accepted', () => {
    expect(parseFechaOrden('11/2025')).toBe(202511)
  })

  test('lowercase dash separator: oct-25 -> 202510', () => {
    expect(parseFechaOrden('oct-25')).toBe(202510)
  })

  test('garbage input -> null', () => {
    expect(parseFechaOrden('garbage')).toBeNull()
  })

  test('null -> null', () => {
    expect(parseFechaOrden(null)).toBeNull()
  })

  test('undefined -> null', () => {
    expect(parseFechaOrden(undefined)).toBeNull()
  })

  test('empty string -> null', () => {
    expect(parseFechaOrden('')).toBeNull()
  })
})

describe('MaestroBuilder — D3 RECIENTE (más reciente wins when no manual)', () => {
  test('BODEGA (202603) beats ABASTO (202510), same macro — one entry, zero conflictos', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-1', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510, razonSocial: 'Cliente Uno' })
    b.observe({ rif: 'J-1', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202603 })

    const { maestro, conflictos } = b.build()

    expect(conflictos).toEqual([])
    expect(maestro.size).toBe(1)
    const entry = maestro.get(normalizeRif('J-1'))
    expect(entry).toEqual({
      rif: 'J-1',
      razonSocial: 'Cliente Uno',
      segmentoN3: 'BODEGA',
      macroN1: UTT,
      metodo: 'MAESTRO',
      confianza: 'N3',
      estadoHabitual: null,
      fechaClasificacion: null,
      reglaCanonica: 'RECIENTE',
    })
  })
})

describe('MaestroBuilder — D3 MANUAL wins over más reciente', () => {
  test('ABASTO manual (202510) beats BODEGA exacto (202603)', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-2', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'MANUAL', fechaOrden: 202510 })
    b.observe({ rif: 'J-2', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202603 })

    const { maestro, conflictos } = b.build()

    expect(conflictos).toEqual([])
    const entry = maestro.get(normalizeRif('J-2'))
    expect(entry?.segmentoN3).toBe('ABASTO')
    expect(entry?.reglaCanonica).toBe('MANUAL')
  })
})

describe('MaestroBuilder — D3 MODA tiebreak', () => {
  test('same macro, tied (null) fechas, counts 5 vs 2 — highest count wins', () => {
    const b = new MaestroBuilder()
    for (let i = 0; i < 2; i++) {
      b.observe({ rif: 'J-3', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: null })
    }
    for (let i = 0; i < 5; i++) {
      b.observe({ rif: 'J-3', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: null })
    }

    const { maestro, conflictos } = b.build()

    expect(conflictos).toEqual([])
    const entry = maestro.get(normalizeRif('J-3'))
    expect(entry?.segmentoN3).toBe('BODEGA')
    expect(entry?.reglaCanonica).toBe('MODA')
  })

  test('manual-pool date tie keeps reglaCanonica MANUAL (provenance), tie broken by count', () => {
    const b = new MaestroBuilder()
    for (let i = 0; i < 2; i++) {
      b.observe({ rif: 'J-3c', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'MANUAL', fechaOrden: 202510 })
    }
    for (let i = 0; i < 5; i++) {
      b.observe({ rif: 'J-3c', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'MANUAL', fechaOrden: 202510 })
    }

    const { maestro, conflictos } = b.build()

    expect(conflictos).toEqual([])
    const entry = maestro.get(normalizeRif('J-3c'))
    expect(entry?.segmentoN3).toBe('BODEGA')            // count breaks the manual-pool date tie
    expect(entry?.reglaCanonica).toBe('MANUAL')          // NOT 'MODA' — provenance preserved
  })

  test('equal counts and equal fechas fall back to alphabetical segmentoN3', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-3b', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })
    b.observe({ rif: 'J-3b', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })

    const { maestro } = b.build()
    const entry = maestro.get(normalizeRif('J-3b'))
    expect(entry?.segmentoN3).toBe('ABASTO')
    expect(entry?.reglaCanonica).toBe('MODA')
  })
})

describe('MaestroBuilder — CONFLICTO_MAYOR (cross-macro, not auto-assigned)', () => {
  test('BODEGA (UTT) + MAYORISTA CON FUERZA DE VENTA (MAYORISTAS) → conflicto, no maestro entry', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-4', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })
    b.observe({ rif: 'J-4', segmentoN3: 'MAYORISTA CON FUERZA DE VENTA', macroN1: MAYORISTAS, metodo: 'EXACTO', fechaOrden: 202603 })

    const { maestro, conflictos } = b.build()

    expect(maestro.has(normalizeRif('J-4'))).toBe(false)
    expect(maestro.size).toBe(0)
    expect(conflictos).toEqual([
      {
        rif: 'J-4',
        razonSocial: null,
        macros: [MAYORISTAS, UTT].sort(),
        segmentos: ['BODEGA', 'MAYORISTA CON FUERZA DE VENTA'].sort(),
        registros: 2,
      },
    ])
  })
})

describe('MaestroBuilder — MANUAL overrides cross-macro conflict (human resolves it)', () => {
  test('BODEGA (UTT, file EXACTO) + MAYORISTA CON FUERZA DE VENTA (MAYORISTAS, MANUAL) → manual wins, no conflicto', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-4b', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202603 })
    b.observe({ rif: 'J-4b', segmentoN3: 'MAYORISTA CON FUERZA DE VENTA', macroN1: MAYORISTAS, metodo: 'MANUAL', fechaOrden: 202510 })

    const { maestro, conflictos } = b.build()

    expect(conflictos).toEqual([])
    expect(maestro.size).toBe(1)
    const entry = maestro.get(normalizeRif('J-4b'))
    expect(entry?.segmentoN3).toBe('MAYORISTA CON FUERZA DE VENTA')
    expect(entry?.macroN1).toBe(MAYORISTAS)
    expect(entry?.reglaCanonica).toBe('MANUAL')
  })
})

describe('MaestroBuilder — RIF format convergence', () => {
  test('J-500522657 and J500522657 accumulate into the same maestro key', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-500522657', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })
    b.observe({ rif: 'J500522657', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202603 })

    expect(b.size()).toBe(1)

    const { maestro, conflictos } = b.build()
    expect(conflictos).toEqual([])
    expect(maestro.size).toBe(1)
    const key = normalizeRif('J-500522657')
    expect(key).toBe(normalizeRif('J500522657'))
    const entry = maestro.get(key)
    expect(entry?.segmentoN3).toBe('BODEGA')
    // first-seen raw rif is preserved
    expect(entry?.rif).toBe('J-500522657')
  })
})

describe('MaestroBuilder — empty segment observations are ignored', () => {
  test('an observation with segmentoN3 "" never creates a maestro entry', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-5', segmentoN3: '', macroN1: UTT, metodo: null, fechaOrden: null })

    const { maestro, conflictos } = b.build()
    expect(maestro.has(normalizeRif('J-5'))).toBe(false)
    expect(maestro.size).toBe(0)
    expect(conflictos).toEqual([])
    expect(b.size()).toBe(0)
  })

  test('a null segmentoN3-like empty string mixed with a valid one still resolves normally', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-6', segmentoN3: '', macroN1: UTT, metodo: null, fechaOrden: null })
    b.observe({ rif: 'J-6', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })

    const { maestro } = b.build()
    const entry = maestro.get(normalizeRif('J-6'))
    expect(entry?.segmentoN3).toBe('ABASTO')
  })
})

describe('MaestroBuilder — size()', () => {
  test('counts distinct RIFs observed with at least one valid segment', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-7', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })
    b.observe({ rif: 'J-7', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202603 })
    b.observe({ rif: 'J-8', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202510 })

    expect(b.size()).toBe(2)
  })
})

describe('MaestroBuilder — estado-only clients', () => {
  test('a client whose rows only ever resolved a state still earns a maestro entry', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-1', segmentoN3: '', macroN1: '', metodo: null, fechaOrden: null, estadoStd: 'ZULIA' })
    const { maestro } = b.build()

    const entry = maestro.get(normalizeRif('J-1'))
    expect(entry).toBeDefined()
    expect(entry).toMatchObject({ segmentoN3: null, macroN1: null, estadoHabitual: 'ZULIA' })
  })

  test('a client with neither a segment nor a state is not stored at all', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-2', segmentoN3: '', macroN1: '', metodo: null, fechaOrden: null, estadoStd: null })
    expect(b.build().maestro.size).toBe(0)
  })

  test('estadoHabitual is the mode across the client\'s rows', () => {
    const b = new MaestroBuilder()
    for (const estadoStd of ['ZULIA', 'ZULIA', 'MIRANDA']) {
      b.observe({ rif: 'J-3', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: null, estadoStd })
    }
    expect(b.build().maestro.get(normalizeRif('J-3'))?.estadoHabitual).toBe('ZULIA')
  })

  test('a tie in the state mode breaks alphabetically, so the result is row-order independent', () => {
    const build = (orden: string[]) => {
      const b = new MaestroBuilder()
      for (const estadoStd of orden) {
        b.observe({ rif: 'J-4', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'EXACTO', fechaOrden: null, estadoStd })
      }
      return b.build().maestro.get(normalizeRif('J-4'))?.estadoHabitual
    }
    expect(build(['ZULIA', 'MIRANDA'])).toBe('MIRANDA')
    expect(build(['MIRANDA', 'ZULIA'])).toBe('MIRANDA')
  })
})

describe('MaestroBuilder — el segmento Otros no compite ni genera conflictos', () => {
  test('Abastos + Otros (macros distintos) NO es CONFLICTO_MAYOR: gana Abastos', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-10', segmentoN3: 'Abastos', macroN1: 'TRADE TRADICIONAL', metodo: 'EXACTO', fechaOrden: 202510 })
    b.observe({ rif: 'J-10', segmentoN3: 'Otros', macroN1: 'OTROS', metodo: 'EXACTO', fechaOrden: 202603 })

    const { maestro, conflictos } = b.build()

    expect(conflictos).toEqual([])
    const entry = maestro.get(normalizeRif('J-10'))
    expect(entry?.segmentoN3).toBe('Abastos')
  })

  test('Otros más reciente NUNCA desplaza a un segmento específico', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-11', segmentoN3: 'Otros', macroN1: 'OTROS', metodo: 'EXACTO', fechaOrden: 202606 })
    b.observe({ rif: 'J-11', segmentoN3: 'Farmacias', macroN1: 'FARMACIAS', metodo: 'EXACTO', fechaOrden: 202501 })

    const { maestro, conflictos } = b.build()
    expect(conflictos).toEqual([])
    expect(maestro.get(normalizeRif('J-11'))?.segmentoN3).toBe('Farmacias')
  })

  test('un cliente observado SOLO como Otros sí queda clasificado Otros', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-12', segmentoN3: 'Otros', macroN1: 'OTROS', metodo: 'EXACTO', fechaOrden: null })

    const { maestro, conflictos } = b.build()
    expect(conflictos).toEqual([])
    expect(maestro.get(normalizeRif('J-12'))?.segmentoN3).toBe('Otros')
  })

  test('una clasificación MANUAL en Otros se respeta sobre lo observado en el archivo', () => {
    const b = new MaestroBuilder()
    b.observe({ rif: 'J-13', segmentoN3: 'Otros', macroN1: 'OTROS', metodo: 'MANUAL', fechaOrden: Number.MAX_SAFE_INTEGER })
    b.observe({ rif: 'J-13', segmentoN3: 'Bodegas', macroN1: 'TRADE TRADICIONAL', metodo: 'EXACTO', fechaOrden: 202603 })

    const { maestro, conflictos } = b.build()
    expect(conflictos).toEqual([])
    const entry = maestro.get(normalizeRif('J-13'))
    expect(entry?.segmentoN3).toBe('Otros')
    expect(entry?.reglaCanonica).toBe('MANUAL')
  })
})
