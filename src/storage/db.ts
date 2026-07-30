// IndexedDB persistence for what the analyst teaches the motor: learned diccionario entries and
// manual maestro classifications (Sprint 2 · C1). Everything here is best-effort — if IndexedDB
// is unavailable (no browser support, private-mode restrictions, ...) getters return empty/
// fallback values and putters no-op, so the app keeps working purely on the embedded SEEDS.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { CiudadEstadoEntry, DiccionarioEntry, EstadoDiccionarioEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'

interface MetaRecord { key: string; value: unknown }

interface MotorDTTSchema extends DBSchema {
  diccionario: { key: string; value: DiccionarioEntry }
  estadoDiccionario: { key: string; value: EstadoDiccionarioEntry }
  ciudadEstado: { key: string; value: CiudadEstadoEntry }
  maestro: { key: string; value: MaestroEntry }
  meta: { key: string; value: MetaRecord }
}

const DB_NAME = 'motor-dtt'
// v2 added `estadoDiccionario`, v3 adds `ciudadEstado`. The upgrade callback below creates every
// store it does not find, so a database at ANY earlier version gains the new stores and keeps all
// of its data — see test/db-migration.test.ts.
const DB_VERSION = 3

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

/** Wipes every learned store — segment diccionario, estado diccionario and manual maestro
 *  (tests / reset). Leaves meta untouched. */
export async function clearLearned(): Promise<void> {
  const db = await openMotorDB()
  if (!db) return
  await db.clear('diccionario')
  await db.clear('estadoDiccionario')
  await db.clear('ciudadEstado')
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

