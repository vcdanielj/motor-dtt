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

  it('correctly resolves Catia La Mar to VARGAS (preventing shadowing by Catia)', () => {
    expect(parseGeoLocation('CATIA LA MAR')?.estadoStd).toBe('VARGAS')
    expect(parseGeoLocation('SECTOR CATIA LA MAR, PLAYA GRANDE')?.estadoStd).toBe('VARGAS')
    expect(parseGeoLocation('MERCADO COMUNITARIO TACAGUA CATIA LA MAR EDO LA GUAIRA')?.estadoStd).toBe('VARGAS')
  })

  it('extracts explicit "EDO + ESTADO" markers in full address strings', () => {
    // Exact patterns reported by users
    expect(parseGeoLocation('AV PRINCIPAL DE SOAPIRE(FRENTE TERMINAL DE ALTO)SOAPIRE EDO MIRANDA')?.estadoStd).toBe('MIRANDA')
    expect(parseGeoLocation('CALLE JULIO MISLE CASA S/N PB SECTOR GABANTE ABAJOCOLONIA TOVAR EDO ARAGUA')?.estadoStd).toBe('ARAGUA')
    expect(parseGeoLocation('CALLE COMERCIO CENTRO DE CAMATAGUA EDO ARAGUA')?.estadoStd).toBe('ARAGUA')
    expect(parseGeoLocation('CALLE PRINCIPAL LA FRANCESA ENTRE CALLEJON EL CARMEN Y EL TIGRE CASA N 1 CONJ RESD GUAICAIPURO LOS TEQUES EDO MIRANDA')?.estadoStd).toBe('MIRANDA')
    expect(parseGeoLocation('MERCADO COMUNITARIO CASA 6 CALLE 17 PUESTO 308 TACAGUA CATIA LA MAR EDO LA GUAIRA')?.estadoStd).toBe('VARGAS')
    expect(parseGeoLocation('CALLE EL PROGRESO CRUCE CON NEGRO PRIMERO Nro 20 SAN PEDRO DE LOS ALTOS EDO MIRANDA')?.estadoStd).toBe('MIRANDA')
    expect(parseGeoLocation('CALLE LOMA CHICA CC LOS GUAYABITOS NIVEL P/B LOCAL 02 Y 03 SECTOR LOS GUAYABITOS CARACAS EDO DISTRITO CAPITAL')?.estadoStd).toBe('DISTRITO CAPITAL')
    expect(parseGeoLocation('AV. ILUSTRES PROCERES AL LADO DEL BANCO CANARIAS ALTAGRACIA DE ORITUCO EDO GUARICO')?.estadoStd).toBe('GUARICO')
    expect(parseGeoLocation('CTRA NACIONAL CAMATAGUA LOCAL NRO S/N SECTOR EL SATELITE CAMATAGUA EDO ARAGUA')?.estadoStd).toBe('ARAGUA')
  })

  it('gives explicit terminal "EDO <ESTADO>" priority over street names mentioning other states', () => {
    // "EL TIGRE" in Anzoátegui is a street name, but address ends in "EDO MIRANDA"
    const addr = 'CALLE PPAL ENTRE CALLEJON EL TIGRE Y EL CARMEN LOS TEQUES EDO MIRANDA'
    expect(parseGeoLocation(addr)?.estadoStd).toBe('MIRANDA')
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

    // Address with EDO MIRANDA when estadoCrudo is 'NO IDENTIFICADO'
    const r4 = resolveEstado({
      rif: null,
      ciudad: 'AV PRINCIPAL DE SOAPIRE(FRENTE TERMINAL DE ALTO)SOAPIRE EDO MIRANDA',
      estadoCrudo: 'NO IDENTIFICADO',
    }, ctx)
    expect(r4.estadoStd).toBe('MIRANDA')
    expect(r4.metodo).toBe('CIUDAD')
    expect(r4.flag).toBe('OK')

    // Address with EDO ARAGUA and concatenated ABAJOCOLONIA TOVAR
    const r5 = resolveEstado({
      rif: null,
      ciudad: 'CALLE JULIO MISLE CASA S/N PB SECTOR GABANTE ABAJOCOLONIA TOVAR EDO ARAGUA',
      estadoCrudo: 'NO IDENTIFICADO',
    }, ctx)
    expect(r5.estadoStd).toBe('ARAGUA')
    expect(r5.metodo).toBe('CIUDAD')
    expect(r5.flag).toBe('OK')
  })
})
