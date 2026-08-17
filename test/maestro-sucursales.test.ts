import { describe, it, expect } from 'vitest'
import { MaestroBuilder } from '@/pipeline/maestro'

describe('MaestroBuilder Multi-Sucursal Tracking', () => {
  it('tracks distinct branches / states for multi-location clients without losing canonical habit state', () => {
    const builder = new MaestroBuilder()

    // Observe Casa Italia in Barinas (3 rows)
    for (let i = 0; i < 3; i++) {
      builder.observe({
        rif: 'J-402116012',
        segmentoN3: 'CHARCUTERIA',
        macroN1: 'TRADICIONAL',
        metodo: 'EXACTO',
        fechaOrden: 202601,
        razonSocial: 'EMBUTIDOS CASA ITALIA',
        estadoStd: 'BARINAS',
        sucursal: 'SUC-BARINAS-01',
        ciudad: 'Barinas',
      })
    }

    // Observe Casa Italia in Portuguesa (2 rows)
    for (let i = 0; i < 2; i++) {
      builder.observe({
        rif: 'J-402116012',
        segmentoN3: 'CHARCUTERIA',
        macroN1: 'TRADICIONAL',
        metodo: 'EXACTO',
        fechaOrden: 202602,
        razonSocial: 'EMBUTIDOS CASA ITALIA',
        estadoStd: 'PORTUGUESA',
        sucursal: 'SUC-ACARIGUA-02',
        ciudad: 'Acarigua',
      })
    }

    const { maestro, conflictos } = builder.build()
    expect(conflictos).toHaveLength(0)

    const entry = maestro.get('J402116012')
    expect(entry).toBeDefined()
    expect(entry?.rif).toBe('J-402116012')
    expect(entry?.segmentoN3).toBe('CHARCUTERIA')
    // Moda state is BARINAS (3 vs 2)
    expect(entry?.estadoHabitual).toBe('BARINAS')

    // Multi-sucursal array must be present and contain both branches
    expect(entry?.sucursales).toBeDefined()
    expect(entry?.sucursales).toHaveLength(2)

    const barinasBranch = entry?.sucursales?.find((s) => s.estadoStd === 'BARINAS')
    const portuguesaBranch = entry?.sucursales?.find((s) => s.estadoStd === 'PORTUGUESA')

    expect(barinasBranch?.registros).toBe(3)
    expect(barinasBranch?.ciudad).toBe('Barinas')

    expect(portuguesaBranch?.registros).toBe(2)
    expect(portuguesaBranch?.ciudad).toBe('Acarigua')
  })
})
