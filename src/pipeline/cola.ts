import { normalizeText } from '@/ingest/normalize'
import { COLA_DOMINIO_POR_TIPO, type ColaItem, type ColaTipo } from '@/contracts/cola'
import { guardTon } from '@/lib/num'
import { cleanEstadoString, isProhibitedEstado } from './estado'
import type { ResolvedRow } from './process-row'

interface Group {
  tipo: ColaTipo
  valorCrudo: string
  registros: number
  ton: number
  sugerencia: { valor: string; score: number } | null
}

export interface ColaAccumulator {
  /** Accumulate the segmento side of a row (grouped by normalized segmentoCrudo). */
  addSegmento(crudo: string, resolved: ResolvedRow, ton: number): void
  /** Accumulate the estado side of a row (grouped by normalized estadoCrudo). */
  addEstado(crudo: string, resolved: ResolvedRow, ton: number): void
  /** Top items by TON, capped PER DOMAIN so a long tail of unresolved segments can never crowd
   *  the unresolved states out of the queue (or vice versa). */
  build(maxPorDominio?: number): ColaItem[]
}

// Stable slug from tipo + normalized crudo — deterministic, no randomness, so the same
// input file always produces the same cola ids across runs. Exported so the worker can mint
// matching ids for CONFLICTO_MAYOR items (built from the maestro, not from row grouping here).
export function stableId(tipo: ColaTipo, valorCrudo: string): string {
  const base = valorCrudo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${tipo.toLowerCase()}-${base || 'sin-valor'}`
}

/** Pure, streaming accumulator for the review queue (PRD cola), covering both domains.
 *
 *  Segmento: a fuzzy suggestion in the band → VARIANTE_NUEVA; an unresolved non-empty crudo with
 *  no suggestion → ALTO_VOLUMEN_SIN_CLASIFICAR.
 *  Estado: same split → ESTADO_VARIANTE_NUEVA / ESTADO_SIN_RESOLVER.
 *
 *  Empty-crudo rows are excluded in both domains (those need the maestro, not the cola).
 *  CONFLICTO_MAYOR is not produced here — it comes from the maestro build. */
export function createColaAccumulator(): ColaAccumulator {
  const groups = new Map<string, Group>()

  const add = (
    tipo: ColaTipo,
    key: string,
    ton: number,
    sugerencia: { valor: string; score: number } | null,
  ) => {
    const mapKey = `${tipo}::${key}`
    let g = groups.get(mapKey)
    if (!g) {
      // Resolution is memoized by the normalized crudo upstream, so every row in this group
      // carries the same suggestion — take it from the first row seen.
      g = { tipo, valorCrudo: key, registros: 0, ton: 0, sugerencia }
      groups.set(mapKey, g)
    }
    g.registros += 1
    g.ton += guardTon(ton)
  }

  return {
    addSegmento(crudo, resolved, ton) {
      const key = normalizeText(crudo)
      if (key === '') return // empty crudo needs the maestro, not the cola

      if (resolved.sugerenciaSegmento) {
        add('VARIANTE_NUEVA', key, ton, {
          valor: resolved.sugerenciaSegmento.segmentoN3,
          score: resolved.sugerenciaSegmento.score,
        })
      } else if (resolved.flagRegistro === 'SIN_CLASIFICAR') {
        add('ALTO_VOLUMEN_SIN_CLASIFICAR', key, ton, null)
      }
    },
    addEstado(crudo, resolved, ton) {
      const key = normalizeText(crudo)
      if (key === '') return // empty crudo needs the maestro/ciudad, not the cola
      if (resolved.estadoStd !== null) return // already resolved by some cascade step
      // R4 placeholders ('NO IDENTIFICADO', 'N/A', '-', …) are the ABSENCE of a state, not a
      // variant of one. There is nothing an analyst could map them to, and the rows carrying
      // them are the ones the maestro's RIF step recovers — so they must never reach the queue.
      if (isProhibitedEstado(key) || isProhibitedEstado(cleanEstadoString(crudo))) return

      if (resolved.sugerenciaEstado) {
        add('ESTADO_VARIANTE_NUEVA', key, ton, {
          valor: resolved.sugerenciaEstado.estadoStd,
          score: resolved.sugerenciaEstado.score,
        })
      } else {
        add('ESTADO_SIN_RESOLVER', key, ton, null)
      }
    },
    build(maxPorDominio = 200) {
      const items: ColaItem[] = Array.from(groups.values()).map((g) => ({
        id: stableId(g.tipo, g.valorCrudo),
        dominio: COLA_DOMINIO_POR_TIPO[g.tipo],
        tipo: g.tipo,
        valorCrudo: g.valorCrudo,
        registrosAfectados: g.registros,
        tonAfectadas: g.ton,
        sugerenciaFuzzy: g.sugerencia,
        resolucion: null,
      }))
      items.sort((a, b) => b.tonAfectadas - a.tonAfectadas)
      const kept: ColaItem[] = []
      const porDominio = { SEGMENTO: 0, ESTADO: 0 }
      for (const item of items) {
        if (porDominio[item.dominio] >= maxPorDominio) continue
        porDominio[item.dominio] += 1
        kept.push(item)
      }
      return kept
    },
  }
}
