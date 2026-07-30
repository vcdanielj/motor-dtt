// Merges what the analyst has taught the motor (persisted in IndexedDB) with the embedded SEEDS,
// so the pipeline/export use the improved config on the next corrida (Sprint 2 · C1). This is the
// foundation C2 (cola resolution) writes into and C3 (config import/export) reads from.
import { normalizeText } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import type { DiccionarioEntry, EstadoDiccionarioEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'
import { getLearnedDiccionario, getLearnedEstados, getManualMaestro } from './db'

export interface RunConfig {
  diccionario: DiccionarioEntry[]              // SEEDS.diccionario ++ learned (learned wins)
  estadoDiccionario: EstadoDiccionarioEntry[]  // SEEDS.estadoDiccionario ++ learned (learned wins)
  manualMaestro: MaestroEntry[]                // persisted manual classifications
}

/** Learned entries win over seed entries sharing the same normalized variante; every other seed
 *  entry passes through unchanged, and all learned entries are kept. Pure. */
export function mergeDiccionario(seed: DiccionarioEntry[], learned: DiccionarioEntry[]): DiccionarioEntry[] {
  const overridden = new Set(learned.map((e) => normalizeText(e.variante)))
  return [...seed.filter((e) => !overridden.has(normalizeText(e.variante))), ...learned]
}

/** Same override semantics as mergeDiccionario, for the estado variant dictionary. Pure. */
export function mergeEstadoDiccionario(
  seed: EstadoDiccionarioEntry[],
  learned: EstadoDiccionarioEntry[],
): EstadoDiccionarioEntry[] {
  const overridden = new Set(learned.map((e) => normalizeText(e.variante)))
  return [...seed.filter((e) => !overridden.has(normalizeText(e.variante))), ...learned]
}

/** Reads the persisted learned dictionaries + manual maestro from IndexedDB and merges them over
 *  SEEDS — the config the next pipeline/export run should use. Falls back to SEEDS-only + no
 *  manual maestro when IndexedDB is empty or unavailable. */
export async function loadRunConfig(): Promise<RunConfig> {
  const [learned, learnedEstados, manualMaestro] = await Promise.all([
    getLearnedDiccionario(),
    getLearnedEstados(),
    getManualMaestro(),
  ])
  return {
    diccionario: mergeDiccionario(SEEDS.diccionario, learned),
    estadoDiccionario: mergeEstadoDiccionario(SEEDS.estadoDiccionario, learnedEstados),
    manualMaestro,
  }
}
