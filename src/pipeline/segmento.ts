import { normalizeText, normalizeRif } from '@/ingest/normalize'
import { bestMatch } from './fuzzy'
import type { MetodoSegmento, ConfianzaSegmento, FlagRegistro } from '@/contracts/row'
import type { MaestroEntry } from '@/contracts/maestro'
import type { DiccionarioEntry } from '@/contracts/config'

export interface SegmentoResult {
  segmentoN3: string | null
  macroN1: string | null
  metodo: MetodoSegmento            // MAESTRO | EXACTO | FUZZY | null
  confianza: ConfianzaSegmento      // N3 | MACRO | null
  fuzzyScore: number | null         // set for FUZZY hits and for suggestions
  sugerencia: { segmentoN3: string; macroN1: string; score: number } | null  // 80-91 band -> cola
  flag: Extract<FlagRegistro, 'OK' | 'SIN_CLASIFICAR'>
}

export interface DiccionarioIndex {
  byKey: Map<string, DiccionarioEntry>   // normalizeText(variante) -> entry
  keys: string[]                          // the normalized keys (for fuzzy candidates)
}

export interface SegmentoContext {
  index: DiccionarioIndex
  maestro: Map<string, MaestroEntry>      // key = normalizeRif(rif)
  fuzzyThreshold: number                  // default 92 (assign)
  fuzzySuggestFloor: number               // default 80 (suggestion)
}

/** Build the normalized index from active diccionario entries. */
export function buildIndex(diccionario: DiccionarioEntry[]): DiccionarioIndex {
  const byKey = new Map<string, DiccionarioEntry>()
  for (const entry of diccionario) {
    if (!entry.activa) continue
    const key = normalizeText(entry.variante)
    if (key === '') continue
    if (!byKey.has(key)) byKey.set(key, entry)
  }
  return { byKey, keys: Array.from(byKey.keys()) }
}

/** Build a maestro lookup keyed by normalized RIF. */
export function buildMaestro(entries: MaestroEntry[]): Map<string, MaestroEntry> {
  const map = new Map<string, MaestroEntry>()
  for (const entry of entries) {
    const key = normalizeRif(entry.rif ?? '')
    if (key === '') continue
    map.set(key, entry)
  }
  return map
}

function sinClasificar(fuzzyScore: number | null): SegmentoResult {
  return {
    segmentoN3: null,
    macroN1: null,
    metodo: null,
    confianza: null,
    fuzzyScore,
    sugerencia: null,
    flag: 'SIN_CLASIFICAR',
  }
}

/** Resolve one record via the MAESTRO -> EXACTO -> FUZZY -> SIN_CLASIFICAR cascade (PRD §6). */
export function resolveSegmento(
  input: { rif: string | null; crudo: string | null },
  ctx: SegmentoContext,
): SegmentoResult {
  // 1. MAESTRO — wins even without a crudo.
  const rifKey = normalizeRif(input.rif ?? '')
  if (rifKey !== '') {
    const maestroEntry = ctx.maestro.get(rifKey)
    if (maestroEntry) {
      const confianza: ConfianzaSegmento =
        maestroEntry.confianza ?? (maestroEntry.segmentoN3 ? 'N3' : 'MACRO')
      return {
        segmentoN3: maestroEntry.segmentoN3,
        macroN1: maestroEntry.macroN1,
        metodo: 'MAESTRO',
        confianza,
        fuzzyScore: null,
        sugerencia: null,
        flag: 'OK',
      }
    }
  }

  // 2. EXACTO — normalized crudo hits the dictionary index.
  const key = normalizeText(input.crudo ?? '')
  if (key === '') return sinClasificar(null)

  const exactEntry = ctx.index.byKey.get(key)
  if (exactEntry) {
    return {
      segmentoN3: exactEntry.segmentoN3,
      macroN1: exactEntry.macroN1,
      metodo: 'EXACTO',
      confianza: 'N3',
      fuzzyScore: null,
      sugerencia: null,
      flag: 'OK',
    }
  }

  // 3./4./5. FUZZY, suggestion band, or SIN_CLASIFICAR.
  const m = bestMatch(key, ctx.index.keys)
  if (m && m.score >= ctx.fuzzyThreshold) {
    const entry = ctx.index.byKey.get(m.candidate)!
    return {
      segmentoN3: entry.segmentoN3,
      macroN1: entry.macroN1,
      metodo: 'FUZZY',
      confianza: 'N3',
      fuzzyScore: m.score,
      sugerencia: null,
      flag: 'OK',
    }
  }

  if (m && m.score >= ctx.fuzzySuggestFloor && m.score < ctx.fuzzyThreshold) {
    const entry = ctx.index.byKey.get(m.candidate)!
    const result = sinClasificar(m.score)
    result.sugerencia = { segmentoN3: entry.segmentoN3, macroN1: entry.macroN1, score: m.score }
    return result
  }

  return sinClasificar(m?.score ?? null)
}
