import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { MetodoEstado, FlagRegistro } from '@/contracts/row'
import type { EstadoDiccionarioEntry } from '@/contracts/config'
import { bestMatch } from './fuzzy'

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

/** R4: values that carry no information. Matched against the CLEANED, normalized text — note that
 *  normalizeText turns '/' '-' '_' '|' into ' / ', so 'N/A' arrives here as 'N / A'. */
const PROHIBITED_ESTADOS = new Set([
  // normalizeText rewrites '-', '_', '|' and '/' to ' / ', so every dash/slash-only cell arrives
  // here as the single token '/'.
  '', '.', '..', '/', '0', '00', 'X', 'XX', 'XXX', '?', 'NULL', 'NULO', 'NONE', 'NINGUNO',
  'NO IDENTIFICADO', 'NO IDENTIFICADA', 'NO IDENTIFICADOS', 'NO APLICA', 'NO DEFINIDO',
  'NO DISPONIBLE', 'NO REGISTRA', 'NO INDICA',
  'N / A', 'NA', 'N / D', 'ND', 'S / I', 'SI', 'SD',
  'SIN ESTADO', 'SIN DEFINIR', 'SIN IDENTIFICAR', 'SIN INFORMACION', 'SIN DATOS', 'SIN DATO',
  'SIN ASIGNAR', 'SIN CLASIFICAR', 'POR DEFINIR', 'POR ASIGNAR', 'PENDIENTE', 'DESCONOCIDO',
  'OTRO', 'OTROS', 'VARIOS', 'GENERICO', 'VENEZUELA',
])

/** R4: a prohibited value is treated as if the cell were empty. */
export function isProhibitedEstado(normalized: string): boolean {
  return PROHIBITED_ESTADOS.has(normalized)
}

// City cells that carry no location: the same R4 placeholders, plus two artifacts seen in real
// exports — 'NAN' (a pandas null that survived a CSV round trip) and 'LOCAL' (a form default).
// Both were verified against a 740K-row file: their rows spread across several estados, so they
// identify nothing and must never feed the CIUDAD step or the review queue.
const PROHIBITED_CIUDADES = new Set([...PROHIBITED_ESTADOS, 'NAN', 'LOCAL', 'S / N', 'SN', 'CIUDAD'])

/** True when a city cell carries no usable location. Input must be normalizeText'd. */
export function isProhibitedCiudad(normalized: string): boolean {
  return PROHIBITED_CIUDADES.has(normalized)
}

// Leading administrative prefixes: 'ESTADO DEL ZULIA', 'EDO. MIRANDA', 'EDO.MIRANDA' (no space),
// 'EDO / MIRANDA' (a hyphen normalizes to ' / '), 'DTTO CAPITAL'. The separator is optional so the
// no-space form is covered; the lookahead keeps a bare 'ESTADO' from collapsing to the empty
// string here — that value is caught by isProhibitedEstado instead.
const PREFIJO_ADMIN = /^(?:ESTADOS?|EDOS?|DTTOS?|DTOS?|DPTOS?)\s*\.?\s*(?:\/\s*)?(?:DEL\s+|DE\s+)?(?=\S)/
// A leading list/sheet code: '13 ZULIA', '13 / ZULIA', '13.- ZULIA'.
const CODIGO_INICIAL = /^\d{1,3}\s*[.\-/]*\s*(?=[A-ZÑ])/
// Trailing noise: 'MIRANDA ESTADO', 'ZULIA / VENEZUELA', 'LARA VZLA'.
const SUFIJO_RUIDO = /\s*(?:\/\s*)?(?:ESTADOS?|EDOS?|VENEZUELA|VZLA)\s*$/

/** Strips the administrative noise around a state name so the catalog lookup can hit. Operates on
 *  normalizeText output (accent-free, uppercase, separators unified to ' / '). Pure. */
export function cleanEstadoString(s: string): string {
  let cleaned = normalizeText(s)
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ')       // drop parentheticals: 'ZULIA (OCCIDENTE)'
  cleaned = cleaned.replace(CODIGO_INICIAL, '')
  cleaned = cleaned.replace(PREFIJO_ADMIN, '')
  cleaned = cleaned.replace(SUFIJO_RUIDO, '')
  return cleaned.replace(/\s+/g, ' ').trim()
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

  // 4. CIUDAD — ciudad_estado lookup (seed ++ learned).
  const c = normalizeText(input.ciudad ?? '')
  if (c !== '' && !isProhibitedCiudad(c)) {
    const ciudadEstado = ctx.ciudadEstado.get(c)
    if (ciudadEstado) return resuelto(ciudadEstado, 'CIUDAD')
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
