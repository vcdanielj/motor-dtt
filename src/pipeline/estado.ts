import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { MetodoEstado, FlagRegistro } from '@/contracts/row'
import type { EstadoDiccionarioEntry } from '@/contracts/config'
import { bestMatch } from './fuzzy'
import { parseGeoLocation } from './geo-parser'
import { cleanEstadoString, isProhibitedEstado, isProhibitedCiudad } from './estado-input'

export { cleanEstadoString, isProhibitedEstado, isProhibitedCiudad } from './estado-input'

export interface EstadoResult {
  estadoStd: string | null
  metodo: MetodoEstado                 // EXACTO | DICCIONARIO | RIF | CIUDAD | FUZZY | null
  fuzzyScore: number | null            // set for FUZZY hits and for suggestions
  /** Fuzzy hit in the [suggestFloor, threshold) band — not assigned, but offered in the cola. */
  sugerencia: { estadoStd: string; score: number } | null
  flag: Extract<FlagRegistro, 'OK' | 'SIN_ESTADO'>
}

export interface EstadoDiccionarioIndex {
  byKey: Map<string, string>           // normalizeText(variante) -> canonical estado
  keys: string[]                       // normalized keys, as fuzzy candidates
}

export interface EstadoContext {
  catalogo: Set<string>                // normalized 24 estados
  catalogoKeys: string[]               // same, as an array for fuzzy candidates
  index: EstadoDiccionarioIndex        // raw -> canonical variant mappings (seed ++ learned)
  estadoByRif: Map<string, string>     // normalizeRif(rif) -> canonical estado (from the maestro)
  ciudadEstado: Map<string, string>    // normalizeText(ciudad) -> canonical estado
  fuzzyThreshold: number               // default 92 (assign)
  fuzzySuggestFloor: number            // default 80 (suggestion)
}

/** Build the normalized variant index from active estado diccionario entries. First occurrence of
 *  a normalized key wins (same rule as buildIndex for segmentos) — mergeEstadoDiccionario already
 *  drops the seed entries a learned entry overrides, so the two never collide here. */
export function buildEstadoIndex(entries: EstadoDiccionarioEntry[]): EstadoDiccionarioIndex {
  const byKey = new Map<string, string>()
  for (const entry of entries) {
    if (!entry.activa) continue
    const key = normalizeText(entry.variante)
    const value = normalizeText(entry.estadoStd)
    if (key === '' || value === '') continue
    if (!byKey.has(key)) byKey.set(key, value)
  }
  return { byKey, keys: Array.from(byKey.keys()) }
}

/** Build the normalized lookup context from the raw seeds (+ optional variant dictionary, RIF
 *  history and thresholds). Thresholds default to the long-standing 92/80 so existing callers
 *  behave exactly as before. */
export function buildEstadoContext(
  estados: string[],
  ciudadEstado: Record<string, string>,
  estadoByRif: Map<string, string> = new Map(),
  estadoDiccionario: EstadoDiccionarioEntry[] = [],
  fuzzyThreshold = 92,
  fuzzySuggestFloor = 80,
): EstadoContext {
  const catalogo = new Set<string>()
  for (const e of estados) {
    const key = normalizeText(e)
    if (key === '') continue
    catalogo.add(key)
  }

  const ciudadEstadoMap = new Map<string, string>()
  for (const [ciudad, estado] of Object.entries(ciudadEstado)) {
    const key = normalizeText(ciudad)
    if (key === '') continue
    ciudadEstadoMap.set(key, normalizeText(estado))
  }

  const estadoByRifMap = new Map<string, string>()
  for (const [rif, estado] of estadoByRif) {
    const key = normalizeRif(rif)
    if (key === '') continue
    estadoByRifMap.set(key, estado)
  }

  return {
    catalogo,
    catalogoKeys: Array.from(catalogo),
    index: buildEstadoIndex(estadoDiccionario),
    estadoByRif: estadoByRifMap,
    ciudadEstado: ciudadEstadoMap,
    fuzzyThreshold,
    fuzzySuggestFloor,
  }
}

function sinEstado(fuzzyScore: number | null = null): EstadoResult {
  return { estadoStd: null, metodo: null, fuzzyScore, sugerencia: null, flag: 'SIN_ESTADO' }
}

function resuelto(estadoStd: string, metodo: MetodoEstado, fuzzyScore: number | null = null): EstadoResult {
  return { estadoStd, metodo, fuzzyScore, sugerencia: null, flag: 'OK' }
}

/** Resolve one record via the EXACTO → DICCIONARIO → RIF → CIUDAD → FUZZY → SIN_ESTADO cascade.
 *
 *  The catalog goes first because it is authoritative. The variant dictionary goes before the RIF
 *  because an explicitly written, mappable state is better evidence than the client's habitual
 *  state. The RIF goes before the city (R4). Pure, never throws. */
export function resolveEstado(
  input: { rif: string | null; ciudad: string | null; estadoCrudo: string | null },
  ctx: EstadoContext,
): EstadoResult {
  const raw = normalizeText(input.estadoCrudo ?? '')
  const limpio = cleanEstadoString(input.estadoCrudo ?? '')
  const usable = limpio !== '' && !isProhibitedEstado(limpio) && !isProhibitedEstado(raw)

  // 1. EXACTO — the cleaned value already IS one of the 24 official estados.
  if (usable && ctx.catalogo.has(limpio)) {
    return resuelto(limpio, 'EXACTO')
  }

  // 2. DICCIONARIO — a known raw→canonical variant. Both the raw and the cleaned forms are tried,
  //    so an entry can be keyed either way ('EDO LA GUAIRA' and 'LA GUAIRA' both work).
  if (usable) {
    const hit = ctx.index.byKey.get(raw) ?? ctx.index.byKey.get(limpio)
    if (hit) return resuelto(hit, 'DICCIONARIO')
  }

  // 3. RIF — the client's habitual estado from the maestro. Beats CIUDAD when they disagree (R4);
  //    enforced by cascade order.
  const rifKey = normalizeRif(input.rif ?? '')
  if (rifKey !== '') {
    const rifEstado = ctx.estadoByRif.get(rifKey)
    if (rifEstado) return resuelto(rifEstado, 'RIF')
  }

  // 4. CIUDAD — ciudad_estado lookup (seed ++ learned) or semantic geo-parser.
  const c = normalizeText(input.ciudad ?? '')
  if (c !== '' && !isProhibitedCiudad(c)) {
    const ciudadEstado = ctx.ciudadEstado.get(c)
    if (ciudadEstado) return resuelto(ciudadEstado, 'CIUDAD')

    // Contextual semantic geo-parse on ciudad (e.g. 'Aragua de Barcelona', 'Av Fuerzas Armadas')
    const geoHit = parseGeoLocation(c)
    if (geoHit && ctx.catalogo.has(normalizeText(geoHit.estadoStd))) {
      return resuelto(normalizeText(geoHit.estadoStd), 'CIUDAD')
    }
  }

  // If estadoCrudo contained a compound city/address name (e.g. distributor typed 'Aragua de Barcelona' in estado col)
  if (raw !== '' && !isProhibitedEstado(raw)) {
    const geoHitRaw = parseGeoLocation(raw)
    if (geoHitRaw && ctx.catalogo.has(normalizeText(geoHitRaw.estadoStd))) {
      return resuelto(normalizeText(geoHitRaw.estadoStd), 'DICCIONARIO')
    }
  }

  // 5./6. FUZZY against the catalog ∪ dictionary keys, then the suggestion band.
  if (!usable) return sinEstado()

  const m = bestMatch(limpio, [...ctx.catalogoKeys, ...ctx.index.keys])
  if (!m) return sinEstado()

  // A catalog key IS the canonical estado; a dictionary key resolves to one.
  const canonical = ctx.catalogo.has(m.candidate) ? m.candidate : ctx.index.byKey.get(m.candidate)
  if (!canonical) return sinEstado(m.score)

  if (m.score >= ctx.fuzzyThreshold) {
    return resuelto(canonical, 'FUZZY', m.score)
  }

  if (m.score >= ctx.fuzzySuggestFloor) {
    const result = sinEstado(m.score)
    result.sugerencia = { estadoStd: canonical, score: m.score }
    return result
  }

  return sinEstado(m.score)
}
