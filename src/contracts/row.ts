// A raw parsed record: distributor headers are arbitrary; keys are original header strings.
export type RawRow = Record<string, string>

// Canonical output metadata columns (PRD §7.3), appended to originals unaltered.
export const OUTPUT_COLUMNS = [
  'segmento_n3_std', 'macro_canal_n1_std', 'metodo_segmento', 'confianza_segmento',
  'estado_std', 'metodo_estado', 'flag_registro',
  'valor_original_segmento', 'valor_original_estado', 'version_diccionario', 'run_id',
] as const
export type OutputColumn = typeof OUTPUT_COLUMNS[number]

export type MetodoSegmento = 'MAESTRO' | 'EXACTO' | 'FUZZY' | 'MANUAL' | null
export type ConfianzaSegmento = 'N3' | 'MACRO' | null
// EXACTO: crudo (cleaned) is already one of the 24 official estados.
// DICCIONARIO: crudo matched a raw→canonical variant mapping (seed ++ learned).
// RIF: taken from the client's habitual estado in the maestro. CIUDAD: inferred from the city.
// FUZZY: near-match against the catalog/dictionary above the configured threshold.
export type MetodoEstado = 'EXACTO' | 'DICCIONARIO' | 'RIF' | 'CIUDAD' | 'FUZZY' | null
export type FlagRegistro = 'OK' | 'SIN_CLASIFICAR' | 'SIN_ESTADO' | 'DUPLICADO' | 'CONFLICTO_MAYOR'

// Which raw header maps to each internal field (produced by schema-detect).
export interface SchemaMap {
  rif: string | null
  segmentoCrudo: string | null
  estadoCrudo: string | null
  ciudad: string | null
  // money/date fields are passed through untouched; recorded for reporting only
  passthrough: string[]
  /** headers that could not be mapped to any known field */
  unmapped: string[]
}
