export interface SegmentoSeed { n3: string; macroN1: string; placeholder: boolean }

export interface DiccionarioEntry { variante: string; segmentoN3: string; macroN1: string; metodo: 'EXACTO'; activa: boolean }

export interface SeedCatalogs {
  segmentos: SegmentoSeed[]
  estados: string[]
  ciudadEstado: Record<string, string>
  diccionario: DiccionarioEntry[]
  provenance: { source: string; placeholder: boolean }
}

export interface AppConfig { versionDiccionario: string; fuzzyThreshold: number; fuzzySuggestFloor: number }
