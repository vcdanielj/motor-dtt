// IndexedDB persistence for what the analyst teaches the motor: learned diccionario entries and
// manual maestro classifications (Sprint 2 · C1). Everything here is best-effort — if IndexedDB
// is unavailable (no browser support, private-mode restrictions, ...) getters return empty/
// fallback values and putters no-op, so the app keeps working purely on the embedded SEEDS.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { DiccionarioEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'

interface MetaRecord { key: string; value: unknown }

interface MotorDTTSchema extends DBSchema {
  diccionario: { key: string; value: DiccionarioEntry }
  maestro: { key: string; value: MaestroEntry }
  meta: { key: string; value: MetaRecord }
}

const DB_NAME = 'motor-dtt'
const DB_VERSION = 1

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

/** All learned diccionario entries (beyond the embedded seeds). [] if IndexedDB is unavailable. */
export async function getLearnedDiccionario(): Promise<DiccionarioEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  return db.getAll('diccionario')
}

/** Persists a learned diccionario entry, keyed by normalizeText(variante) — re-putting a
 *  differently-cased/spaced variante that normalizes to the same key overwrites the prior entry. */
export async function putLearnedDiccionario(entry: DiccionarioEntry): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.put('diccionario', { ...entry, variante: normalizeText(entry.variante) })
}

/** All manually-classified maestro entries (metodo: 'MANUAL'). [] if IndexedDB is unavailable. */
export async function getManualMaestro(): Promise<MaestroEntry[]> {
  const db = await openMotorDB()
  if (!db) return []
  return db.getAll('maestro')
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

/** Wipes the learned diccionario + manual maestro stores (tests / reset). Leaves meta untouched. */
export async function clearLearned(): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.clear('diccionario')
  await db.clear('maestro')
}
