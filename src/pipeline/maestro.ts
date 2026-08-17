import { normalizeRif } from '@/ingest/normalize'
import type { MetodoSegmento } from '@/contracts/row'
import type { MaestroEntry, ClienteSucursal } from '@/contracts/maestro'

export interface Observation {
  rif: string
  segmentoN3: string
  macroN1: string
  metodo: MetodoSegmento          // how THIS row was resolved (EXACTO|FUZZY|MANUAL|MAESTRO|null)
  fechaOrden: number | null       // sortable recency key, higher = more recent. Null if unknown.
  razonSocial?: string | null     // optional client name (first seen wins)
  estadoStd?: string | null       // resolved state
  sucursal?: string | null        // branch code or name
  ciudad?: string | null          // branch city
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

interface SucursalAggregate {
  codigoSucursal?: string
  nombreSucursal?: string
  estadoStd: string
  ciudad?: string
  count: number
}

interface RifAggregate {
  rawRif: string                              // first seen raw rif
  razonSocial: string | null                   // first non-empty seen
  registros: number
  segmentos: Map<string, SegmentoAggregate>    // segmentoN3 -> aggregate
  estados: Map<string, number>                 // estadoStd -> count
  sucursales: Map<string, SucursalAggregate>   // key -> branch aggregate
}

/** Accumulates per-row observations into compact per-RIF aggregates (not a growing row list),
 *  then applies PRD rule D3 (MANUAL > más reciente > moda) to build the canonical maestro. */
export class MaestroBuilder {
  private rifs = new Map<string, RifAggregate>()

  observe(o: Observation): void {
    const key = normalizeRif(o.rif)
    if (key === '') return

    const hasSegment = o.segmentoN3 != null && o.segmentoN3.trim() !== ''
    const hasState = o.estadoStd != null && o.estadoStd.trim() !== ''
    if (!hasSegment && !hasState) return

    let agg = this.rifs.get(key)
    if (!agg) {
      agg = { rawRif: o.rif, razonSocial: null, registros: 0, segmentos: new Map(), estados: new Map(), sucursales: new Map() }
      this.rifs.set(key, agg)
    }
    if ((agg.razonSocial == null || agg.razonSocial === '') && o.razonSocial) {
      agg.razonSocial = o.razonSocial
    }
    agg.registros++

    if (o.estadoStd) {
      agg.estados.set(o.estadoStd, (agg.estados.get(o.estadoStd) ?? 0) + 1)

      const sucKey = `${o.sucursal ?? ''}::${o.estadoStd}::${o.ciudad ?? ''}`
      let sucAgg = agg.sucursales.get(sucKey)
      if (!sucAgg) {
        sucAgg = {
          codigoSucursal: o.sucursal ?? undefined,
          nombreSucursal: o.sucursal ?? undefined,
          estadoStd: o.estadoStd,
          ciudad: o.ciudad ?? undefined,
          count: 0,
        }
        agg.sucursales.set(sucKey, sucAgg)
      }
      sucAgg.count++
    }

    if (o.segmentoN3 == null || o.segmentoN3.trim() === '') return

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

      const sucursalesList: ClienteSucursal[] = [...agg.sucursales.values()]
        .map((s) => ({
          codigoSucursal: s.codigoSucursal,
          nombreSucursal: s.nombreSucursal,
          estadoStd: s.estadoStd,
          ciudad: s.ciudad,
          registros: s.count,
        }))
        .sort((a, b) => b.registros - a.registros)

      // Estado-only client: no row ever resolved a segment, but at least one resolved a state.
      // It still earns a maestro entry so the estado cascade's RIF step can recover the client's
      // other rows. segmentoN3/macroN1 stay null and resolveSegmento skips such entries, so this
      // can never masquerade as a classification.
      if (segEntries.length === 0) {
        const estadoHabitual = modaEstado(agg.estados)
        if (estadoHabitual === null) continue
        maestro.set(key, {
          rif: agg.rawRif,
          razonSocial: agg.razonSocial,
          segmentoN3: null,
          macroN1: null,
          metodo: null,
          confianza: null,
          estadoHabitual,
          sucursales: sucursalesList.length > 0 ? sucursalesList : undefined,
          fechaClasificacion: null,
          reglaCanonica: null,
        })
        continue
      }

      // A MANUAL observation IS the human resolving the conflict, so it overrides cross-macro
      // detection: only RIFs with no manual observation can raise CONFLICTO_MAYOR.
      const hasManual = segEntries.some(([, s]) => s.hasManual)
      const macros = [...new Set(segEntries.map(([, s]) => s.macroN1))]
      if (!hasManual && macros.length > 1) {
        conflictos.push({
          rif: agg.rawRif,
          macros: macros.sort(),
          segmentos: segEntries.map(([n3]) => n3).sort(),
          registros: agg.registros,
        })
        continue
      }

      const [winnerSegmento, reglaCanonica] = pickWinner(segEntries)
      const winnerMacro = agg.segmentos.get(winnerSegmento)?.macroN1 ?? macros[0]

      const estadoHabitual = modaEstado(agg.estados)

      maestro.set(key, {
        rif: agg.rawRif,
        razonSocial: agg.razonSocial,
        segmentoN3: winnerSegmento,
        macroN1: winnerMacro,
        metodo: 'MAESTRO',
        confianza: 'N3',
        estadoHabitual,
        sucursales: sucursalesList.length > 0 ? sucursalesList : undefined,
        fechaClasificacion: null,
        reglaCanonica,
      })
    }

    return { maestro, conflictos }
  }
}

/** The client's habitual estado: the most-observed one, ties broken alphabetically so the result
 *  does not depend on row order. Null when no row ever resolved a state for this client. */
function modaEstado(estados: Map<string, number>): string | null {
  let mejor: string | null = null
  let mejorCount = 0
  for (const [estado, count] of estados) {
    if (count > mejorCount || (count === mejorCount && mejor !== null && estado < mejor)) {
      mejor = estado
      mejorCount = count
    }
  }
  return mejor
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
  ENE: 1, ENERO: 1, JAN: 1, JANUARY: 1,
  FEB: 2, FEBRERO: 2, FEBRUARY: 2,
  MAR: 3, MARZO: 3, MARCH: 3,
  ABR: 4, ABRIL: 4, APR: 4, APRIL: 4,
  MAY: 5, MAYO: 5,
  JUN: 6, JUNIO: 6, JUNE: 6,
  JUL: 7, JULIO: 7, JULY: 7,
  AGO: 8, AGOSTO: 8, AUG: 8, AUGUST: 8,
  SEP: 9, SEPTIEMBRE: 9, SETIEMBRE: 9, SEPT: 9, SEPTEMBER: 9,
  OCT: 10, OCTUBRE: 10, OCTOBER: 10,
  NOV: 11, NOVIEMBRE: 11, NOVEMBER: 11,
  DIC: 12, DICIEMBRE: 12, DEC: 12, DECEMBER: 12,
}

/** Parse a MES/FECHA string to a sortable YYYYMM integer. Handles 'Oct/25'/'OCT-25', 'Octubre 2025',
 *  'MM/YYYY', 'YYYY-MM', 'YYYY-MM-DD', 'DD/MM/YYYY', ISO timestamps and Excel serial numbers.
 *  Returns null if unparseable. Pure. */
export function parseFechaOrden(s: unknown): number | null {
  if (s == null) return null
  if (typeof s === 'number') {
    // Excel serial date number e.g. 45000 -> 2023, 46000 -> 2026
    if (s > 20000 && s < 80000) {
      const d = new Date((s - 25569) * 86400 * 1000)
      if (!isNaN(d.getTime())) {
        return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1)
      }
    }
  }

  const str = String(s).trim()
  if (str === '') return null

  // ISO or full YYYY-MM-DD e.g. '2025-10-15' or '2025-10-15T00:00:00.000Z'
  let m = /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/.exec(str)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) {
      return year * 100 + month
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY e.g. '15/10/2025'
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(str)
  if (m) {
    const month = Number(m[2])
    const year = Number(m[3])
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) {
      return year * 100 + month
    }
  }

  // MM/YYYY or MM-YYYY e.g. '10/2025'
  m = /^(\d{1,2})[-/](\d{4})$/.exec(str)
  if (m) {
    const month = Number(m[1])
    const year = Number(m[2])
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) {
      return year * 100 + month
    }
  }

  // Month name with 2-digit or 4-digit year: 'Oct/25', 'OCT-2025', 'Octubre 2025', 'OCT. 25'
  m = /^([A-Za-z]+)[.\s/-]+(\d{2,4})$/.exec(str)
  if (m) {
    const monthKey = m[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    const month = MESES[monthKey]
    if (month) {
      let yy = Number(m[2])
      if (yy < 100) yy = (yy >= 50 ? 1900 : 2000) + yy
      return yy * 100 + month
    }
  }

  // Month name with leading year: '2025-Oct', '2025 Octubre'
  m = /^(\d{4})[.\s/-]+([A-Za-z]+)$/.exec(str)
  if (m) {
    const year = Number(m[1])
    const monthKey = m[2].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    const month = MESES[monthKey]
    if (month && year >= 1990 && year <= 2100) {
      return year * 100 + month
    }
  }

  return null
}
