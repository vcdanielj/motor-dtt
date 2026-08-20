import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { ClienteAliasEntry } from '@/contracts/config'

/** Sentinel for a client code used by MORE THAN ONE distributor with different RIFs — matching it
 *  without the distributor would be guessing, so the code-only tier refuses it. */
const AMBIGUO = Symbol('alias-ambiguo')

export interface AliasIndex {
  byDistCode: Map<string, ClienteAliasEntry> // "DISTRIBUIDOR::CODIGO" -> entry
  /** Code-only fallback: normalized codigoCliente -> entry when GLOBALLY unique, AMBIGUO when
   *  two distributors share the code with different canonical RIFs. Distributor names in the
   *  alias table rarely match the file's distributor column verbatim ("Campesino" vs
   *  "ALIMENTOS CAMPESINO C.A."), and codes like 'BAR-00236' are distinctive — without this
   *  tier most homologations silently never fired. */
  byCode: Map<string, ClienteAliasEntry | typeof AMBIGUO>
}

export function makeAliasKey(distribuidor: string, codigoCliente: string): string {
  const d = normalizeText(distribuidor)
  const c = normalizeText(codigoCliente)
  return `${d}::${c}`
}

export function buildAliasIndex(entries: ClienteAliasEntry[] = []): AliasIndex {
  const byDistCode = new Map<string, ClienteAliasEntry>()
  const byCode = new Map<string, ClienteAliasEntry | typeof AMBIGUO>()
  for (const e of entries) {
    if (!e.activa) continue
    const key = makeAliasKey(e.distribuidor, e.codigoCliente)
    const rif = normalizeRif(e.rifCanonico)
    if (key === '::' || rif === '') continue
    const entry = { ...e, rifCanonico: rif }
    if (!byDistCode.has(key)) {
      byDistCode.set(key, entry)
    }

    // Only DISTINCTIVE codes enter the code-only tier: at least 4 chars and at least one letter
    // ('BAR-00236', 'CLI-9901'). A short or purely numeric code ('236', '00125') is far too easy
    // to collide with another distributor's numbering — those resolve only via the exact tier.
    const codeKey = normalizeText(e.codigoCliente)
    if (codeKey.length < 4 || !/[A-Z]/.test(codeKey)) continue
    const prior = byCode.get(codeKey)
    if (prior === undefined) {
      byCode.set(codeKey, entry)
    } else if (prior !== AMBIGUO && prior.rifCanonico !== rif) {
      byCode.set(codeKey, AMBIGUO)
    }
  }
  return { byDistCode, byCode }
}

/** Resolve a distributor client code to its canonical alias entry.
 *  Tier 1: exact (normalized) distribuidor::codigo. Tier 2: the code alone, only when it is
 *  globally unique across all alias entries — an ambiguous code never matches. */
export function resolveAlias(
  distribuidor: string | null | undefined,
  codigoCliente: string | null | undefined,
  index: AliasIndex
): ClienteAliasEntry | null {
  if (!codigoCliente) return null

  if (distribuidor) {
    const key = makeAliasKey(distribuidor, codigoCliente)
    const exact = index.byDistCode.get(key)
    if (exact) return exact
  }

  const byCode = index.byCode.get(normalizeText(codigoCliente))
  if (byCode !== undefined && byCode !== AMBIGUO) return byCode
  return null
}
