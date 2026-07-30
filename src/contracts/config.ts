export interface SegmentoSeed { n3: string; macroN1: string; codigo: string; placeholder: boolean }

export interface DiccionarioEntry { variante: string; segmentoN3: string; macroN1: string; codigo: string; metodo: 'EXACTO'; activa: boolean }

/** One raw→canonical state mapping. The estado counterpart of DiccionarioEntry: `variante` is the
 *  text as it appears in distributor files, `estadoStd` MUST be one of the 24 official estados
 *  (the catalog stays authoritative — e.g. 'LA GUAIRA' is a variante of 'VARGAS', not a new estado). */
export interface EstadoDiccionarioEntry { variante: string; estadoStd: string; activa: boolean }

export interface SeedCatalogs {
  segmentos: SegmentoSeed[]
  estados: string[]
  ciudadEstado: Record<string, string>
  diccionario: DiccionarioEntry[]
  estadoDiccionario: EstadoDiccionarioEntry[]
  provenance: { source: string; placeholder: boolean }
}

export interface AppConfig { versionDiccionario: string; fuzzyThreshold: number; fuzzySuggestFloor: number }
