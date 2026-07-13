import type { DiccionarioEntry } from '@/contracts/config'

const E = (variante: string, segmentoN3: string, macroN1: string): DiccionarioEntry => ({
  variante,
  segmentoN3,
  macroN1,
  metodo: 'EXACTO',
  activa: true,
})

// Seed grows via the cola (Sprint 5). Sourced from prototype trzPool (lines 646–653) + PRD examples.
export const DICCIONARIO: DiccionarioEntry[] = [
  E('BODEGAS', 'BODEGA', 'TRADE TRADICIONAL (UTT)'),
  E('ABASTOS', 'ABASTO', 'TRADE TRADICIONAL (UTT)'),
  E('MINI MARKETS', 'MINI MARKET', 'SUPERMERCADOS INDEPENDIENTES'),
  E('PANADERIAS', 'PANADERIA', 'TRADE TRADICIONAL (UTT)'),
  E('BODEGONES', 'BODEGON', 'BODEGONES'),
  E('LICORERIAS', 'LICORERIA', 'TRADE TRADICIONAL (UTT)'),
]
