import type { SegmentoSeed } from '@/contracts/config'
import { normalizeText } from '@/ingest/normalize'

// Fuente: catálogo oficial CEC (agosto 2026). La medición usa EXACTAMENTE estos 14 segmentos N3;
// todo lo que no calce en los 13 específicos se clasifica en 'Otros' (segmento per se, no un
// pendiente). Los macro-canales agrupan familias afines para la detección de conflictos del
// maestro (un cliente observado en dos macros distintos sí es un CONFLICTO_MAYOR; dos segmentos
// del mismo macro se resuelven por moda/recencia sin molestar al analista).
export const SEGMENTOS: SegmentoSeed[] = [
  { n3: 'Abastos', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-01', placeholder: false },
  { n3: 'Bodegas', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-02', placeholder: false },
  { n3: 'Bodegones', macroN1: 'BODEGONES', codigo: 'DTT-03', placeholder: false },
  { n3: 'Carniceria, charcuteria y Frigorifico', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-04', placeholder: false },
  { n3: 'Farmacias', macroN1: 'FARMACIAS', codigo: 'DTT-05', placeholder: false },
  { n3: 'Horeca', macroN1: 'HORECA', codigo: 'DTT-06', placeholder: false },
  { n3: 'Kioscos', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-07', placeholder: false },
  { n3: 'Licorerias y Bares', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-08', placeholder: false },
  { n3: 'Mayoristas', macroN1: 'MAYORISTAS', codigo: 'DTT-09', placeholder: false },
  { n3: 'Otros', macroN1: 'OTROS', codigo: 'DTT-10', placeholder: false },
  { n3: 'Panaderias y Pastelerias', macroN1: 'TRADE TRADICIONAL', codigo: 'DTT-11', placeholder: false },
  { n3: 'SMI', macroN1: 'SMI', codigo: 'DTT-12', placeholder: false },
  { n3: 'SMI - Mini Market', macroN1: 'SMI', codigo: 'DTT-13', placeholder: false },
  { n3: 'Tiendas de conveniencias', macroN1: 'TIENDAS DE CONVENIENCIA', codigo: 'DTT-14', placeholder: false },
]

export const MACROS_N1 = [...new Set(SEGMENTOS.map((s) => s.macroN1))]

/** El segmento comodín del catálogo oficial. */
export const SEGMENTO_OTROS = 'Otros'

/** True cuando un N3 es el comodín 'Otros' (comparación normalizada, acepta el legado 'OTROS'). */
export function esSegmentoOtros(n3: string | null | undefined): boolean {
  return n3 != null && normalizeText(n3) === 'OTROS'
}

const porN3 = new Map(SEGMENTOS.map((s) => [normalizeText(s.n3), s]))

/** Busca un segmento del catálogo oficial por su N3 (comparación normalizada). */
export function segmentoPorN3(n3: string | null | undefined): SegmentoSeed | null {
  if (n3 == null) return null
  return porN3.get(normalizeText(n3)) ?? null
}

// Catálogo anterior (37 N3 del Entregable 2.1) → segmento oficial vigente. Las reglas aprendidas
// y el maestro manual persistidos en IndexedDB pueden traer estos nombres; se remapean al leerlos
// para que ninguna corrida vuelva a emitir un segmento fuera de los 14 oficiales.
const LEGACY_N3: Record<string, string> = {
  'ABASTO': 'Abastos',
  'BODEGA': 'Bodegas',
  'PUESTO DE MERCADO': 'Abastos',
  'KIOSCO': 'Kioscos',
  'PANADERIA': 'Panaderias y Pastelerias',
  'PASTELERIA': 'Panaderias y Pastelerias',
  'CARNICERIA / CHARCUTERIA / FRIGORIFICO': 'Carniceria, charcuteria y Frigorifico',
  'LICORERIA': 'Licorerias y Bares',
  'CONFITERIA': 'Kioscos',
  'FARMACIA TRADICIONAL (MOSTRADOR)': 'Farmacias',
  'PERFUMERIA TRADICIONAL': 'Otros',
  'FERRETERIA / QUINCALLERIA': 'Otros',
  'SUPERMERCADO INDEPENDIENTE GRANDE': 'SMI',
  'SUPERMERCADO INDEPENDIENTE MEDIANO': 'SMI',
  'SUPERMERCADO INDEPENDIENTE PEQUEÑO': 'SMI',
  'AUTOMERCADO': 'SMI',
  'MINI MARKET': 'SMI - Mini Market',
  'CADENA NACIONAL': 'Otros',
  'CADENA REGIONAL': 'Otros',
  'HIPERMERCADO / CASH & CARRY': 'Otros',
  'FARMACIA CON AUTOSERVICIO': 'Farmacias',
  'FARMACIA CADENA': 'Farmacias',
  'FARMACIA MODERNA INDEPENDIENTE': 'Farmacias',
  'BODEGON': 'Bodegones',
  'BODEGON / LICORERIA': 'Bodegones',
  'MAYORISTA CON FUERZA DE VENTA': 'Mayoristas',
  'MAYORISTA SIN FUERZA DE VENTA': 'Mayoristas',
  'NANO DISTRIBUIDOR': 'Mayoristas',
  'SUB / DISTRIBUIDOR': 'Mayoristas',
  'RESTAURANTE': 'Horeca',
  'FAST FOOD': 'Horeca',
  'LUNCHERIA / CAFETERIA': 'Horeca',
  'HOTEL / POSADA': 'Horeca',
  'CATERING / INSTITUCIONAL': 'Horeca',
  'TIENDA DE CONVENIENCIA': 'Tiendas de conveniencias',
  'TIENDA PARA BEBE': 'Otros',
  'PIÑATERIA / TIENDA DE REGALO': 'Otros',
}

const legacyPorKey = new Map(Object.entries(LEGACY_N3).map(([k, v]) => [normalizeText(k), v]))

/** Resuelve cualquier N3 (oficial o del catálogo anterior) al segmento oficial vigente.
 *  Devuelve null cuando el valor no corresponde a ningún segmento conocido. */
export function migrarSegmentoN3(n3: string | null | undefined): SegmentoSeed | null {
  if (n3 == null || n3.trim() === '') return null
  const oficial = segmentoPorN3(n3)
  if (oficial) return oficial
  const legado = legacyPorKey.get(normalizeText(n3))
  return legado ? segmentoPorN3(legado) : null
}
