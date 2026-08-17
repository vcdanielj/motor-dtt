export interface SegmentoSeed { n3: string; macroN1: string; codigo: string; placeholder: boolean }

export interface DiccionarioEntry { variante: string; segmentoN3: string; macroN1: string; codigo: string; metodo: 'EXACTO'; activa: boolean }

/** One raw→canonical state mapping. The estado counterpart of DiccionarioEntry: `variante` is the
 *  text as it appears in distributor files, `estadoStd` MUST be one of the 24 official estados
 *  (the catalog stays authoritative — e.g. 'LA GUAIRA' is a variante of 'VARGAS', not a new estado). */
export interface EstadoDiccionarioEntry { variante: string; estadoStd: string; activa: boolean }

/** One city→estado mapping the analyst taught the motor. The learned counterpart of the
 *  CIUDAD_ESTADO seed: distributors label routes with parish or neighbourhood names the seed
 *  cannot anticipate ('EL PARAISO / LAS FUENTES'), so the queue lets a human map them once. */
export interface CiudadEstadoEntry { ciudad: string; estadoStd: string; activa: boolean }

/** One client code alias mapping (e.g. Campesino's BAR-00236 -> canonical RIF). */
export interface ClienteAliasEntry {
  distribuidor: string
  codigoCliente: string
  rifCanonico: string
  razonSocial?: string
  estadoStd?: string
  activa: boolean
}

export interface SeedCatalogs {
  segmentos: SegmentoSeed[]
  estados: string[]
  ciudadEstado: Record<string, string>
  diccionario: DiccionarioEntry[]
  estadoDiccionario: EstadoDiccionarioEntry[]
  aliases?: ClienteAliasEntry[]
  provenance: { source: string; placeholder: boolean }
}

export interface AppConfig { versionDiccionario: string; fuzzyThreshold: number; fuzzySuggestFloor: number }
