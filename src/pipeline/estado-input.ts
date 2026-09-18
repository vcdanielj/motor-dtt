import { normalizeText } from '@/ingest/normalize'

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
