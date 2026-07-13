import type { SeedCatalogs } from '@/contracts/config'
import { SEGMENTOS } from './segmentos'
import { ESTADOS } from './estados'
import { CIUDAD_ESTADO } from './ciudad-estado'
import { DICCIONARIO } from './diccionario'

export const SEEDS: SeedCatalogs = {
  segmentos: SEGMENTOS,
  estados: ESTADOS,
  ciudadEstado: CIUDAD_ESTADO,
  diccionario: DICCIONARIO,
  provenance: { source: 'prototype SEGS + PRD §7.1 (PLACEHOLDER)', placeholder: true },
}

// Re-export directly from each module to avoid self-import
export { SEGMENTOS } from './segmentos'
export { ESTADOS } from './estados'
export { CIUDAD_ESTADO } from './ciudad-estado'
export { DICCIONARIO } from './diccionario'
