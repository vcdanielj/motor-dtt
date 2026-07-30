/** Which field a queue item is about. SEGMENTO items resolve into the segment diccionario (or the
 *  maestro, for CONFLICTO_MAYOR); ESTADO items resolve into the estado diccionario. */
export type ColaDominio = 'SEGMENTO' | 'ESTADO'

export type ColaTipo =
  | 'VARIANTE_NUEVA'
  | 'CONFLICTO_MAYOR'
  | 'ALTO_VOLUMEN_SIN_CLASIFICAR'
  | 'ESTADO_VARIANTE_NUEVA'
  | 'ESTADO_SIN_RESOLVER'
  // A city the motor does not know, on rows whose state stayed unresolved. Resolving it teaches
  // the ciudad→estado map, which is the only lever for the route names distributors invent.
  | 'CIUDAD_SIN_MAPEAR'

/** The dominio is a function of the tipo — kept as a lookup so every producer (worker, mocks,
 *  store) derives it the same way instead of each hand-setting a field that could drift. */
export const COLA_DOMINIO_POR_TIPO: Record<ColaTipo, ColaDominio> = {
  VARIANTE_NUEVA: 'SEGMENTO',
  CONFLICTO_MAYOR: 'SEGMENTO',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'SEGMENTO',
  ESTADO_VARIANTE_NUEVA: 'ESTADO',
  ESTADO_SIN_RESOLVER: 'ESTADO',
  CIUDAD_SIN_MAPEAR: 'ESTADO',
}

export interface ColaItem {
  id: string
  dominio: ColaDominio
  tipo: ColaTipo
  valorCrudo: string
  registrosAfectados: number
  tonAfectadas: number
  /** Fuzzy hit inside the suggestion band. `valor` is a segmentoN3 for SEGMENTO items and a
   *  canonical estado for ESTADO items — the dominio says which. */
  sugerenciaFuzzy: { valor: string; score: number } | null
  resolucion: string | null
}
