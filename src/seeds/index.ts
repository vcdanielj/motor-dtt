import type { SeedCatalogs } from '@/contracts/config'
import { SEGMENTOS } from './segmentos'
import { ESTADOS } from './estados'
import { CIUDAD_ESTADO } from './ciudad-estado'
import { DICCIONARIO } from './diccionario'
import { ESTADO_DICCIONARIO } from './estados-diccionario'

export const SEEDS: SeedCatalogs = {
  segmentos: SEGMENTOS,
  estados: ESTADOS,
  ciudadEstado: CIUDAD_ESTADO,
  diccionario: DICCIONARIO,
  estadoDiccionario: ESTADO_DICCIONARIO,
  provenance: { source: 'Catálogo oficial CEC (14 segmentos, agosto 2026) + Entregable 2.1 Hoja 2 (estados); diccionario de variantes remapeado y ampliado con la data real Sell Out 2025-2026', placeholder: false },
}

// Re-export directly from each module to avoid self-import
export { SEGMENTOS } from './segmentos'
export { ESTADOS } from './estados'
export { CIUDAD_ESTADO } from './ciudad-estado'
export { DICCIONARIO } from './diccionario'
export { ESTADO_DICCIONARIO } from './estados-diccionario'
