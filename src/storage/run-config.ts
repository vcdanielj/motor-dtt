// Merges what the analyst has taught the motor (persisted in IndexedDB) with the embedded SEEDS,
// so the pipeline/export use the improved config on the next corrida (Sprint 2 · C1). This is the
// foundation C2 (cola resolution) writes into and C3 (config import/export) reads from.
import { normalizeText } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import type { CiudadEstadoEntry, DiccionarioEntry, EstadoDiccionarioEntry, ClienteAliasEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'
import { getLearnedCiudades, getLearnedDiccionario, getLearnedEstados, getManualMaestro, getLearnedAliases } from './db'
import { makeAliasKey } from '@/pipeline/alias'

export interface RunConfig {
  diccionario: DiccionarioEntry[]              // SEEDS.diccionario ++ learned (learned wins)
  estadoDiccionario: EstadoDiccionarioEntry[]  // SEEDS.estadoDiccionario ++ learned (learned wins)
  ciudadEstado: Record<string, string>         // SEEDS.ciudadEstado ++ learned (learned wins)
  manualMaestro: MaestroEntry[]                // persisted manual classifications
  aliases: ClienteAliasEntry[]                 // persisted client aliases
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

/** Learned city mappings win over the seed for the same normalized city name. Returns the plain
 *  Record shape buildEstadoContext already consumes. Pure. */
export function mergeCiudadEstado(
  seed: Record<string, string>,
  learned: CiudadEstadoEntry[],
): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [ciudad, estado] of Object.entries(seed)) merged[normalizeText(ciudad)] = estado
  for (const e of learned) {
    if (!e.activa) continue
    merged[normalizeText(e.ciudad)] = e.estadoStd
  }
  return merged
}

/** Learned alias mappings win over seeds sharing the same distribuidor + codigoCliente. */
export function mergeAliases(seed: ClienteAliasEntry[] = [], learned: ClienteAliasEntry[] = []): ClienteAliasEntry[] {
  const overridden = new Set(learned.map((a) => makeAliasKey(a.distribuidor, a.codigoCliente)))
  return [...seed.filter((a) => !overridden.has(makeAliasKey(a.distribuidor, a.codigoCliente))), ...learned]
}

/** Reads the persisted learned dictionaries + manual maestro + aliases from IndexedDB and merges them over
 *  SEEDS — the config the next pipeline/export run should use. */
export async function loadRunConfig(): Promise<RunConfig> {
  const [learned, learnedEstados, learnedCiudades, manualMaestro, learnedAliases] = await Promise.all([
    getLearnedDiccionario(),
    getLearnedEstados(),
    getLearnedCiudades(),
    getManualMaestro(),
    getLearnedAliases(),
  ])
  return {
    diccionario: mergeDiccionario(SEEDS.diccionario, learned),
    estadoDiccionario: mergeEstadoDiccionario(SEEDS.estadoDiccionario, learnedEstados),
    ciudadEstado: mergeCiudadEstado(SEEDS.ciudadEstado, learnedCiudades),
    manualMaestro,
    aliases: mergeAliases(SEEDS.aliases ?? [], learnedAliases),
  }
}
