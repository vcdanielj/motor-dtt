import type { ConfianzaSegmento, MetodoSegmento } from './row'

export interface MaestroEntry {
  rif: string
  razonSocial: string | null
  segmentoN3: string | null
  macroN1: string | null
  metodo: MetodoSegmento
  confianza: ConfianzaSegmento
  estadoHabitual: string | null
  fechaClasificacion: string | null   // ISO
  reglaCanonica: 'MANUAL' | 'RECIENTE' | 'MODA' | null
}
