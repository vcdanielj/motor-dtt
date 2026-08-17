import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { ClienteAliasEntry } from '@/contracts/config'

export interface AliasIndex {
  byDistCode: Map<string, ClienteAliasEntry> // "DISTRIBUIDOR::CODIGO" -> entry
}

export function makeAliasKey(distribuidor: string, codigoCliente: string): string {
  const d = normalizeText(distribuidor)
  const c = normalizeText(codigoCliente)
  return `${d}::${c}`
}

export function buildAliasIndex(entries: ClienteAliasEntry[] = []): AliasIndex {
  const byDistCode = new Map<string, ClienteAliasEntry>()
  for (const e of entries) {
    if (!e.activa) continue
    const key = makeAliasKey(e.distribuidor, e.codigoCliente)
    const rif = normalizeRif(e.rifCanonico)
    if (key === '::' || rif === '') continue
    if (!byDistCode.has(key)) {
      byDistCode.set(key, { ...e, rifCanonico: rif })
    }
  }
  return { byDistCode }
}

export function resolveAlias(
  distribuidor: string | null | undefined,
  codigoCliente: string | null | undefined,
  index: AliasIndex
): ClienteAliasEntry | null {
  if (!distribuidor || !codigoCliente) return null
  const key = makeAliasKey(distribuidor, codigoCliente)
  return index.byDistCode.get(key) ?? null
}
