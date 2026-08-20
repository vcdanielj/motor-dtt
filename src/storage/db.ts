// IndexedDB persistence for what the analyst teaches the motor: learned diccionario entries and
// manual maestro classifications (Sprint 2 · C1). Everything here is best-effort — if IndexedDB
// is unavailable (no browser support, private-mode restrictions, ...) getters return empty/
// fallback values and putters no-op, so the app keeps working purely on the embedded SEEDS.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import { migrarSegmentoN3 } from '@/seeds/segmentos'
import type { CiudadEstadoEntry, DiccionarioEntry, EstadoDiccionarioEntry, ClienteAliasEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'
import { makeAliasKey } from '@/pipeline/alias'

interface MetaRecord { key: string; value: unknown }

interface MotorDTTSchema extends DBSchema {
  diccionario: { key: string; value: DiccionarioEntry }
  estadoDiccionario: { key: string; value: EstadoDiccionarioEntry }
  ciudadEstado: { key: string; value: CiudadEstadoEntry }
  aliases: { key: string; value: ClienteAliasEntry }
  maestro: { key: string; value: MaestroEntry }
  meta: { key: string; value: MetaRecord }
}

const DB_NAME = 'motor-dtt'
// v2 added `estadoDiccionario`, v3 adds `ciudadEstado`, v4 adds `aliases`.
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase<MotorDTTSchema> | null> | null = null

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

// Lazily opens (and caches) the singleton DB connection. Resolves to null — never throws — when
// IndexedDB isn't available or the open itself fails, so every public function below can treat
// "no db" as a normal, silent fallback path.
function openMotorDB(): Promise<IDBPDatabase<MotorDTTSchema> | null> {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    if (!isIndexedDBAvailable()) return null
    try {
      return await openDB<MotorDTTSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('diccionario')) db.createObjectStore('diccionario', { keyPath: 'variante' })
          if (!db.objectStoreNames.contains('estadoDiccionario')) db.createObjectStore('estadoDiccionario', { keyPath: 'variante' })
          if (!db.objectStoreNames.contains('ciudadEstado')) db.createObjectStore('ciudadEstado', { keyPath: 'ciudad' })
          if (!db.objectStoreNames.contains('aliases')) db.createObjectStore('aliases')
          if (!db.objectStoreNames.contains('maestro')) db.createObjectStore('maestro', { keyPath: 'rif' })
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
        },
      })
    } catch {
      return null
    }
  })()
  return dbPromise
}

/** All learned diccionario entries (beyond the embedded seeds), migrated to the official
 *  14-segment catalog on read: entries taught while the old 37-N3 catalog was live are remapped
 *  ('ABASTO' → 'Abastos', 'MINI MARKET' → 'SMI - Mini Market', …) so no corrida can ever emit a
 *  segment outside the official list. Entries pointing at nothing recognizable are dropped.
 *  [] if IndexedDB is unavailable. */
export async function getLearnedDiccionario(): Promise<DiccionarioEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  const entries = await db.getAll('diccionario')
  const migrated: DiccionarioEntry[] = []
  for (const e of entries) {
    const seg = migrarSegmentoN3(e.segmentoN3)
    if (!seg) continue
    migrated.push({ ...e, segmentoN3: seg.n3, macroN1: seg.macroN1, codigo: seg.codigo })
  }
  return migrated
}

/** Persists a learned diccionario entry, keyed by normalizeText(variante) — re-putting a
 *  differently-cased/spaced variante that normalizes to the same key overwrites the prior entry. */
export async function putLearnedDiccionario(entry: DiccionarioEntry): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.put('diccionario', { ...entry, variante: normalizeText(entry.variante) })
}

/** All learned estado variants (beyond the embedded seeds). [] if IndexedDB is unavailable. */
export async function getLearnedEstados(): Promise<EstadoDiccionarioEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  return db.getAll('estadoDiccionario')
}

/** Persists a learned estado variant, keyed by normalizeText(variante) — re-putting a
 *  differently-cased/spaced variante that normalizes to the same key overwrites the prior entry. */
export async function putLearnedEstado(entry: EstadoDiccionarioEntry): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.put('estadoDiccionario', { ...entry, variante: normalizeText(entry.variante) })
}

/** Deletes a specific learned estado variant (normalizing the key first). */
export async function deleteLearnedEstado(variante: string): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.delete('estadoDiccionario', normalizeText(variante))
}

/** All learned city→estado mappings (beyond the embedded seed). [] if IndexedDB is unavailable. */
export async function getLearnedCiudades(): Promise<CiudadEstadoEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  return db.getAll('ciudadEstado')
}

/** Persists a learned city→estado mapping, keyed by normalizeText(ciudad). */
export async function putLearnedCiudad(entry: CiudadEstadoEntry): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.put('ciudadEstado', { ...entry, ciudad: normalizeText(entry.ciudad) })
}

/** Deletes a specific learned city mapping (normalizing the key first). */
export async function deleteLearnedCiudad(ciudad: string): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.delete('ciudadEstado', normalizeText(ciudad))
}

/** All learned client code aliases (beyond the embedded seeds). [] if IndexedDB is unavailable. */
export async function getLearnedAliases(): Promise<ClienteAliasEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  return db.getAll('aliases')
}

/** Persists a learned client alias, keyed by makeAliasKey(distribuidor, codigoCliente). */
export async function putLearnedAlias(entry: ClienteAliasEntry): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  const key = makeAliasKey(entry.distribuidor, entry.codigoCliente)
  await db.put('aliases', entry, key)
}

/** Deletes a specific client alias mapping. */
export async function deleteLearnedAlias(distribuidor: string, codigoCliente: string): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  const key = makeAliasKey(distribuidor, codigoCliente)
  await db.delete('aliases', key)
}

/** All manually-classified maestro entries (metodo: 'MANUAL'), with any old-catalog segment
 *  remapped to the official 14 on read (an unrecognizable segment is nulled out — the entry's
 *  estadoHabitual is still worth keeping). [] if IndexedDB is unavailable. */
export async function getManualMaestro(): Promise<MaestroEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  const entries = await db.getAll('maestro')
  return entries.map((e) => {
    if (e.segmentoN3 == null) return e
    const seg = migrarSegmentoN3(e.segmentoN3)
    return seg
      ? { ...e, segmentoN3: seg.n3, macroN1: seg.macroN1 }
      : { ...e, segmentoN3: null, macroN1: null }
  })
}

/** Persists a manual maestro classification, keyed by normalizeRif(rif). */
export async function putManualMaestro(entry: MaestroEntry): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.put('maestro', { ...entry, rif: normalizeRif(entry.rif) })
}

/** Reads a meta config value (thresholds, versionDiccionario, counters, ...), falling back when
 *  absent or when IndexedDB is unavailable. */
export async function getMeta<T = unknown>(key: string, fallback: T): Promise<T> {
  const db = await openMotorDB()
  if (!db) return fallback
  const record = await db.get('meta', key)
  return record ? (record.value as T) : fallback
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.put('meta', { key, value })
}

/** Wipes every learned store — segment diccionario, estado diccionario, ciudad, aliases and manual maestro
 *  (tests / reset). Leaves meta untouched. */
export async function clearLearned(): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.clear('diccionario')
  await db.clear('estadoDiccionario')
  await db.clear('ciudadEstado')
  await db.clear('aliases')
  await db.clear('maestro')
}

/** Deletes a specific learned diccionario entry by variant (normalizing the key first). */
export async function deleteLearnedDiccionario(variante: string): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.delete('diccionario', normalizeText(variante))
}

/** Deletes a specific manual maestro classification by RIF (normalizing the key first). */
export async function deleteManualMaestro(rif: string): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.delete('maestro', normalizeRif(rif))
}

