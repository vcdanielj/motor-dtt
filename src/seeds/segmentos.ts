import type { SegmentoSeed } from '@/contracts/config'

const P = true

export const SEGMENTOS: SegmentoSeed[] = [
  { n3: 'ABASTO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PUESTO DE MERCADO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'KIOSCO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PANADERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PASTELERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'CARNICERIA / CHARCUTERIA / FRIGORIFICO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'LICORERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'CONFITERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'FARMACIA TRADICIONAL', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PERFUMERIA TRADICIONAL', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'FERRETERIA / QUINCALLERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'SUPERMERCADO IND. GRANDE', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'SUPERMERCADO IND. MEDIANO', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'SUPERMERCADO IND. PEQUEÑO', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'AUTOMERCADO', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'MINI MARKET', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'CADENA NACIONAL', macroN1: 'CADENAS', placeholder: P },
  { n3: 'CADENA REGIONAL', macroN1: 'CADENAS', placeholder: P },
  { n3: 'HIPERMERCADO / CASH & CARRY', macroN1: 'CADENAS', placeholder: P },
  { n3: 'TIENDA DE CONVENIENCIA', macroN1: 'CADENAS', placeholder: P },
  { n3: 'FARMACIA CON AUTOSERVICIO', macroN1: 'FARMACIAS MODERNAS', placeholder: P },
  { n3: 'FARMACIA CADENA', macroN1: 'FARMACIAS MODERNAS', placeholder: P },
  { n3: 'FARMACIA MODERNA INDEPENDIENTE', macroN1: 'FARMACIAS MODERNAS', placeholder: P },
  { n3: 'BODEGON', macroN1: 'BODEGONES', placeholder: P },
  { n3: 'BODEGON-LICORERIA', macroN1: 'BODEGONES', placeholder: P },
  { n3: 'MAYORISTA CON FUERZA DE VENTA', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'MAYORISTA SIN FUERZA DE VENTA', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'NANO DISTRIBUIDOR', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'SUB-DISTRIBUIDOR', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'RESTAURANTE', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'FAST FOOD', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'LUNCHERIA / CAFETERIA', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'HOTEL / POSADA', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'CATERING / INSTITUCIONAL', macroN1: 'ON PREMISE', placeholder: P },
]

// Prototype SEGS yields 35 N3 across 7 macros. PRD cites 8 N1 macro-canales — the 8th
// (e-commerce/otros) is absent from the prototype and awaits Entregable 3.1.
export const MACROS_N1 = [...new Set(SEGMENTOS.map((s) => s.macroN1))]
