import { describe, it, expect } from 'vitest'
import { parseGeoLocation } from '@/pipeline/geo-parser'
import { resolveEstado, buildEstadoContext } from '@/pipeline/estado'
import { SEEDS } from '@/seeds'

describe('parseGeoLocation (Venezuelan Multi-token Semantic Geo-Parser)', () => {
  it('disambiguates compound names like "Aragua de Barcelona" into ANZOATEGUI (not Aragua)', () => {
    const res = parseGeoLocation('ARAGUA DE BARCELONA')
    expect(res).not.toBeNull()
    expect(res?.estadoStd).toBe('ANZOATEGUI')
  })

  it('resolves famous Caracas avenues to DISTRITO CAPITAL', () => {
    expect(parseGeoLocation('AV FUERZAS ARMADAS')?.estadoStd).toBe('DISTRITO CAPITAL')
    expect(parseGeoLocation('AVENIDA FUERZAS ARMADAS, EDIF CENTRO')?.estadoStd).toBe('DISTRITO CAPITAL')
    expect(parseGeoLocation('AV BARALT, ESQUINA MUCURITAS')?.estadoStd).toBe('DISTRITO CAPITAL')
    expect(parseGeoLocation('AVENIDA URDANETA')?.estadoStd).toBe('DISTRITO CAPITAL')
    expect(parseGeoLocation('PLAZA VENEZUELA')?.estadoStd).toBe('DISTRITO CAPITAL')
    expect(parseGeoLocation('CATIA')?.estadoStd).toBe('DISTRITO CAPITAL')
  })

  it('resolves metropolitan zones and compound city names', () => {
    expect(parseGeoLocation('GRAN VALENCIA')?.estadoStd).toBe('CARABOBO')
    expect(parseGeoLocation('NAGUANAGUA')?.estadoStd).toBe('CARABOBO')
    expect(parseGeoLocation('ALTOS MIRANDINOS')?.estadoStd).toBe('MIRANDA')
    expect(parseGeoLocation('SAN ANTONIO DE LOS ALTOS')?.estadoStd).toBe('MIRANDA')
    expect(parseGeoLocation('COSTA ORIENTAL DEL LAGO')?.estadoStd).toBe('ZULIA')
    expect(parseGeoLocation('CIUDAD GUAYANA')?.estadoStd).toBe('BOLIVAR')
    expect(parseGeoLocation('PUNTO FIJO')?.estadoStd).toBe('FALCON')
    expect(parseGeoLocation('SANTA CRUZ DE ARAGUA')?.estadoStd).toBe('ARAGUA')
  })

  it('integrates seamlessly with resolveEstado cascade on messy addresses', () => {
    const ctx = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado, new Map(), SEEDS.estadoDiccionario, 92, 80)
    
    // Ciudad contains compound phrase
    const r1 = resolveEstado({ rif: null, ciudad: 'Aragua de Barcelona', estadoCrudo: null }, ctx)
    expect(r1.estadoStd).toBe('ANZOATEGUI')
    expect(r1.metodo).toBe('CIUDAD')

    // Estado column contains compound city
    const r2 = resolveEstado({ rif: null, ciudad: null, estadoCrudo: 'Gran Valencia' }, ctx)
    expect(r2.estadoStd).toBe('CARABOBO')
    expect(r2.metodo).toBe('DICCIONARIO')

    // Avenida Fuerzas Armadas in ciudad
    const r3 = resolveEstado({ rif: null, ciudad: 'Av. Fuerzas Armadas', estadoCrudo: null }, ctx)
    expect(r3.estadoStd).toBe('DISTRITO CAPITAL')
    expect(r3.metodo).toBe('CIUDAD')
  })
})
