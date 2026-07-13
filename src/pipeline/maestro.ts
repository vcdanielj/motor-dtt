import { normalizeRif } from '@/ingest/normalize'
import type { MetodoSegmento } from '@/contracts/row'
import type { MaestroEntry } from '@/contracts/maestro'

/** One row's observed segment/macro for a RIF, feeding the maestro builder. */
export interface Observation {
  rif: string
  segmentoN3: string
  macroN1: string
  metodo: MetodoSegmento          // how THIS row was resolved (EXACTO|FUZZY|MANUAL|MAESTRO|null)
  fechaOrden: number | null       // sortable recency key, higher = more recent. Null if unknown.
  razonSocial?: string | null     // optional client name (first seen wins)
}

/** A cross-macro conflict: this RIF was observed under more than one macro-canal — CONFLICTO_MAYOR. */
export interface Conflicto {
  rif: string                      // raw rif (first seen)
  macros: string[]                 // the distinct macro-canales in conflict
  segmentos: string[]              // the distinct N3 observed
  registros: number                // total observations for this rif
}

export interface MaestroBuildResult {
  maestro: Map<string, MaestroEntry>   // key = normalizeRif(rif)
  conflictos: Conflicto[]              // cross-macro conflicts (CONFLICTO_MAYOR)
}

interface SegmentoAggregate {
  count: number
  macroN1: string
  latestFecha: number | null
  hasManual: boolean
}

interface RifAggregate {
  rawRif: string                              // first seen raw rif
  razonSocial: string | null                   // first non-empty seen
  registros: number
  segmentos: Map<string, SegmentoAggregate>    // segmentoN3 -> aggregate
}

/** Accumulates per-row observations into compact per-RIF aggregates (not a growing row list),
 *  then applies PRD rule D3 (MANUAL > más reciente > moda) to build the canonical maestro. */
export class MaestroBuilder {
  private rifs = new Map<string, RifAggregate>()

  observe(o: Observation): void {
    if (o.segmentoN3 == null || o.segmentoN3.trim() === '') return

    const key = normalizeRif(o.rif)
    if (key === '') return

    let agg = this.rifs.get(key)
    if (!agg) {
      agg = { rawRif: o.rif, razonSocial: null, registros: 0, segmentos: new Map() }
      this.rifs.set(key, agg)
    }
    if ((agg.razonSocial == null || agg.razonSocial === '') && o.razonSocial) {
      agg.razonSocial = o.razonSocial
    }
    agg.registros++

    let seg = agg.segmentos.get(o.segmentoN3)
    if (!seg) {
      seg = { count: 0, macroN1: o.macroN1, latestFecha: null, hasManual: false }
      agg.segmentos.set(o.segmentoN3, seg)
    }
    seg.count++
    if (o.fechaOrden != null && (seg.latestFecha == null || o.fechaOrden > seg.latestFecha)) {
      seg.latestFecha = o.fechaOrden
    }
    if (o.metodo === 'MANUAL') seg.hasManual = true
  }

  size(): number {
    return this.rifs.size
  }

  build(): MaestroBuildResult {
    const maestro = new Map<string, MaestroEntry>()
    const conflictos: Conflicto[] = []

    for (const [key, agg] of this.rifs) {
      const segEntries = [...agg.segmentos.entries()]
      if (segEntries.length === 0) continue

      const macros = [...new Set(segEntries.map(([, s]) => s.macroN1))]
      if (macros.length > 1) {
        conflictos.push({
          rif: agg.rawRif,
          macros: macros.sort(),
          segmentos: segEntries.map(([n3]) => n3).sort(),
          registros: agg.registros,
        })
        continue
      }

      const [winnerSegmento, reglaCanonica] = pickWinner(segEntries)
      maestro.set(key, {
        rif: agg.rawRif,
        razonSocial: agg.razonSocial,
        segmentoN3: winnerSegmento,
        macroN1: macros[0],
        metodo: 'MAESTRO',
        confianza: 'N3',
        estadoHabitual: null,
        fechaClasificacion: null,
        reglaCanonica,
      })
    }

    return { maestro, conflictos }
  }
}

type SegEntry = [string, SegmentoAggregate]
type ReglaCanonica = 'MANUAL' | 'RECIENTE' | 'MODA'

/** D3: MANUAL > más reciente > moda (alphabetical final tiebreak).
 *  Provenance rule: when the winner comes from the MANUAL pool, reglaCanonica stays 'MANUAL'
 *  regardless of how an internal date/count tie was broken. 'RECIENTE'/'MODA' apply ONLY when
 *  the RIF has no manual observation. */
function pickWinner(segEntries: SegEntry[]): [string, ReglaCanonica] {
  const manualEntries = segEntries.filter(([, s]) => s.hasManual)
  const isManual = manualEntries.length > 0
  const pool = isManual ? manualEntries : segEntries

  const maxFecha = pool.reduce<number | null>((max, [, s]) => {
    if (s.latestFecha == null) return max
    if (max == null || s.latestFecha > max) return s.latestFecha
    return max
  }, null)

  const candidates = pool.filter(([, s]) => s.latestFecha === maxFecha)
  candidates.sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count
    return a[0].localeCompare(b[0])
  })

  // Manual provenance always labels MANUAL, even when a tie was broken by count/alphabetical.
  if (isManual) return [candidates[0][0], 'MANUAL']
  // No manual: single strict-max fecha → RECIENTE; a fecha tie across ≥2 (or all null) → MODA.
  const regla: ReglaCanonica = candidates.length > 1 ? 'MODA' : 'RECIENTE'
  return [candidates[0][0], regla]
}

const MESES: Record<string, number> = {
  ENE: 1, JAN: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4, APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8, AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12, DEC: 12,
}

/** Parse a MES/FECHA string to a sortable YYYYMM integer. Handles 'Oct/25'/'OCT-25' (Spanish/English
 *  3-letter month + 2-digit year), 'MM/YYYY', 'YYYY-MM'. Returns null if unparseable. Pure. */
export function parseFechaOrden(s: string | null | undefined): number | null {
  if (s == null) return null
  const trimmed = s.trim()
  if (trimmed === '') return null

  let m = /^(\d{4})-(\d{1,2})$/.exec(trimmed)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    return month >= 1 && month <= 12 ? year * 100 + month : null
  }

  m = /^(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (m) {
    const month = Number(m[1])
    const year = Number(m[2])
    return month >= 1 && month <= 12 ? year * 100 + month : null
  }

  m = /^([A-Za-z]{3})[/-](\d{2})$/.exec(trimmed)
  if (m) {
    const month = MESES[m[1].toUpperCase()]
    if (!month) return null
    const yy = Number(m[2])
    return (2000 + yy) * 100 + month
  }

  return null
}
