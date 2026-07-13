// Merges what the analyst has taught the motor (persisted in IndexedDB) with the embedded SEEDS,
// so the pipeline/export use the improved config on the next corrida (Sprint 2 · C1). This is the
// foundation C2 (cola resolution) writes into and C3 (config import/export) reads from.
import { normalizeText } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import type { DiccionarioEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'
import { getLearnedDiccionario, getManualMaestro } from './db'

export interface RunConfig {
  diccionario: DiccionarioEntry[]   // SEEDS.diccionario ++ learned (learned wins on collision)
  manualMaestro: MaestroEntry[]     // persisted manual classifications
}

/** Learned entries win over seed entries sharing the same normalized variante; every other seed
 *  entry passes through unchanged, and all learned entries are kept. Pure. */
export function mergeDiccionario(seed: DiccionarioEntry[], learned: DiccionarioEntry[]): DiccionarioEntry[] {
  const overridden = new Set(learned.map((e) => normalizeText(e.variante)))
  return [...seed.filter((e) => !overridden.has(normalizeText(e.variante))), ...learned]
}

/** Reads the persisted learned diccionario + manual maestro from IndexedDB and merges the
 *  diccionario over SEEDS — the config the next pipeline/export run should use. Falls back to
 *  SEEDS-only + no manual maestro when IndexedDB is empty or unavailable. */
export async function loadRunConfig(): Promise<RunConfig> {
  const [learned, manualMaestro] = await Promise.all([getLearnedDiccionario(), getManualMaestro()])
  return { diccionario: mergeDiccionario(SEEDS.diccionario, learned), manualMaestro }
}
