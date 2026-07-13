import type { MetodoSegmento, MetodoEstado } from '@/contracts/row'
import type { ResolvedRow } from './process-row'

export interface DistribuidorMetric {
  nombre: string
  registros: number
  exactoCrudo: number // rows whose metodoSegmento === 'EXACTO' (distributor sent a directly-usable segment) — D5 basis
  resueltoPost: number // rows with flagRegistro !== 'SIN_CLASIFICAR' (segment resolved by ANY method)
  estadoValido: number // rows with estadoStd !== null
  ton: number // sum of TON
  tonSinClasificar: number // TON in rows where segment unresolved
  metodo: { MAESTRO: number; EXACTO: number; FUZZY: number; SIN_CLASIFICAR: number }
}

export interface TotalsMetric {
  registros: number
  porMetodoSegmento: { MAESTRO: number; EXACTO: number; FUZZY: number; SIN_CLASIFICAR: number }
  estadoValido: number
  porMetodoEstado: { EXACTO: number; RIF: number; CIUDAD: number; SIN_ESTADO: number }
  ton: number
}

type SegBucket = keyof DistribuidorMetric['metodo']
type EstBucket = keyof TotalsMetric['porMetodoEstado']

function segmentoBucket(metodo: MetodoSegmento): SegBucket {
  switch (metodo) {
    case 'MAESTRO':
    case 'EXACTO':
    case 'FUZZY':
      return metodo
    default:
      return 'SIN_CLASIFICAR'
  }
}

function estadoBucket(metodo: MetodoEstado): EstBucket {
  switch (metodo) {
    case 'EXACTO':
    case 'RIF':
    case 'CIUDAD':
      return metodo
    default:
      return 'SIN_ESTADO'
  }
}

function guardTon(ton: number): number {
  return Number.isFinite(ton) ? ton : 0
}

function newDistribuidorMetric(nombre: string): DistribuidorMetric {
  return {
    nombre,
    registros: 0,
    exactoCrudo: 0,
    resueltoPost: 0,
    estadoValido: 0,
    ton: 0,
    tonSinClasificar: 0,
    metodo: { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 },
  }
}

function newTotalsMetric(): TotalsMetric {
  return {
    registros: 0,
    porMetodoSegmento: { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 },
    estadoValido: 0,
    porMetodoEstado: { EXACTO: 0, RIF: 0, CIUDAD: 0, SIN_ESTADO: 0 },
    ton: 0,
  }
}

/** Streaming per-distributor + overall metrics accumulator. Mutable by design — call
 *  `add` once per row in a single pass; never collect all rows in memory. */
export class MetricsAccumulator {
  private readonly dists = new Map<string, DistribuidorMetric>()
  private readonly totalsAcc = newTotalsMetric()

  add(distribuidor: string, r: ResolvedRow, ton: number): void {
    const safeTon = guardTon(ton)
    const segBucket = segmentoBucket(r.metodoSegmento)
    const estBucket = estadoBucket(r.metodoEstado)

    let d = this.dists.get(distribuidor)
    if (!d) {
      d = newDistribuidorMetric(distribuidor)
      this.dists.set(distribuidor, d)
    }

    d.registros += 1
    if (r.metodoSegmento === 'EXACTO') d.exactoCrudo += 1
    if (r.flagRegistro !== 'SIN_CLASIFICAR') d.resueltoPost += 1
    if (r.estadoStd !== null) d.estadoValido += 1
    d.ton += safeTon
    if (r.flagRegistro === 'SIN_CLASIFICAR') d.tonSinClasificar += safeTon
    d.metodo[segBucket] += 1

    this.totalsAcc.registros += 1
    this.totalsAcc.porMetodoSegmento[segBucket] += 1
    if (r.estadoStd !== null) this.totalsAcc.estadoValido += 1
    this.totalsAcc.porMetodoEstado[estBucket] += 1
    this.totalsAcc.ton += safeTon
  }

  /** Snapshot of per-distributor metrics, sorted by ton descending. */
  distribuidores(): DistribuidorMetric[] {
    return Array.from(this.dists.values())
      .map((d) => ({ ...d, metodo: { ...d.metodo } }))
      .sort((a, b) => b.ton - a.ton)
  }

  /** Snapshot of the overall totals. */
  totals(): TotalsMetric {
    return {
      ...this.totalsAcc,
      porMetodoSegmento: { ...this.totalsAcc.porMetodoSegmento },
      porMetodoEstado: { ...this.totalsAcc.porMetodoEstado },
    }
  }
}

function pct1(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

/** SCDC over crudo (D5): share of rows the distributor sent in a directly-usable format. */
export function scdcCrudoPct(d: DistribuidorMetric): number {
  return pct1(d.exactoCrudo, d.registros)
}

/** Share of rows resolved by any method (post-cascade). */
export function scdcPostPct(d: DistribuidorMetric): number {
  return pct1(d.resueltoPost, d.registros)
}
