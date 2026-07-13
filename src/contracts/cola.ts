export type ColaTipo = 'VARIANTE_NUEVA' | 'CONFLICTO_MAYOR' | 'ALTO_VOLUMEN_SIN_CLASIFICAR'

export interface ColaItem {
  id: string
  tipo: ColaTipo
  valorCrudo: string
  registrosAfectados: number
  tonAfectadas: number
  sugerenciaFuzzy: { segmentoN3: string; score: number } | null   // only when 80–91
  resolucion: string | null
}
