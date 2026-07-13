import { normalizeText } from '@/ingest/normalize'
import type { ColaItem, ColaTipo } from '@/contracts/cola'
import type { ResolvedRow } from './process-row'

interface Group {
  tipo: ColaTipo
  valorCrudo: string
  registros: number
  ton: number
  sugerencia: { segmentoN3: string; score: number } | null
}

export interface ColaAccumulator {
  addRow(crudo: string, resolved: ResolvedRow, ton: number): void
  build(maxItems?: number): ColaItem[]
}

function guardTon(ton: number): number {
  return Number.isFinite(ton) ? ton : 0
}

// Stable slug from tipo + normalized crudo — deterministic, no randomness, so the same
// input file always produces the same cola ids across runs.
function stableId(tipo: ColaTipo, valorCrudo: string): string {
  const base = valorCrudo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${tipo.toLowerCase()}-${base || 'sin-valor'}`
}

/** Pure, streaming accumulator for the review queue (PRD cola). Groups rows by
 *  normalizeText(crudo): a 80–91 fuzzy suggestion band → VARIANTE_NUEVA, an unresolved
 *  non-empty crudo with no suggestion → ALTO_VOLUMEN_SIN_CLASIFICAR. Empty-crudo rows are
 *  excluded (those need the maestro, not the cola). CONFLICTO_MAYOR is not produced here
 *  (pass-1 has no dedup pass). */
export function createColaAccumulator(): ColaAccumulator {
  const groups = new Map<string, Group>()

  return {
    addRow(crudo, resolved, ton) {
      const key = normalizeText(crudo)
      if (key === '') return // empty crudo needs the maestro, not the cola

      let tipo: ColaTipo | null = null
      if (resolved.sugerenciaSegmento) tipo = 'VARIANTE_NUEVA'
      else if (resolved.flagRegistro === 'SIN_CLASIFICAR') tipo = 'ALTO_VOLUMEN_SIN_CLASIFICAR'
      if (!tipo) return

      const mapKey = `${tipo}::${key}`
      let g = groups.get(mapKey)
      if (!g) {
        g = {
          tipo,
          valorCrudo: key,
          registros: 0,
          ton: 0,
          // Segment resolution is memoized by normalizeText(crudo) upstream, so every row in
          // this group carries the same suggestion — take it from the first row seen.
          sugerencia: resolved.sugerenciaSegmento
            ? { segmentoN3: resolved.sugerenciaSegmento.segmentoN3, score: resolved.sugerenciaSegmento.score }
            : null,
        }
        groups.set(mapKey, g)
      }
      g.registros += 1
      g.ton += guardTon(ton)
    },
    build(maxItems = 200) {
      const items: ColaItem[] = Array.from(groups.values()).map((g) => ({
        id: stableId(g.tipo, g.valorCrudo),
        tipo: g.tipo,
        valorCrudo: g.valorCrudo,
        registrosAfectados: g.registros,
        tonAfectadas: g.ton,
        sugerenciaFuzzy: g.sugerencia,
        resolucion: null,
      }))
      items.sort((a, b) => b.tonAfectadas - a.tonAfectadas)
      return items.slice(0, maxItems)
    },
  }
}
