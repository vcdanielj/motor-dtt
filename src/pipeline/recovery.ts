import type { EstadoTally, MethodTally } from '@/contracts/pipeline'
import type { MaestroEntry } from '@/contracts/maestro'

/** Per-RIF tally of rows that stayed SIN_CLASIFICAR during the streaming pass, kept only for
 *  rows whose RIF is non-empty (those are the only ones the maestro can ever recover). */
export interface UnresueltoTally {
  count: number
  ton: number
  rif: string
  razonSocial: string
  distribuidor: string
}

export interface MaestroRecoveryInput {
  segmento: MethodTally
  tonSinClasificar: number
  unresueltoPorRif: Map<string, UnresueltoTally>            // rifKey -> { count, ton } (global)
  unresueltoDistRif: Map<string, Map<string, number>>       // distribuidor -> rifKey -> count
  maestro: Map<string, MaestroEntry>                        // rifKey -> entry (from MaestroBuilder.build())
}

export interface MaestroRecoveryResult {
  segmento: MethodTally             // new object: SIN_CLASIFICAR reduced, MAESTRO increased
  tonSinClasificar: number          // reduced by the recovered rows' TON
  recuperados: number               // total rows recovered by RIF this run
  recuperadosPorDist: Map<string, number>  // distribuidor -> rows recovered (post-cascade only)
}

/** End-of-pass adjustment (Sprint-2 M2): a row whose segment never resolved during the stream
 *  but whose RIF turned out to be known to the maestro (because OTHER rows for that same client
 *  resolved via EXACTO/FUZZY) gets reclassified SIN_CLASIFICAR -> MAESTRO. Pure and side-effect
 *  free — never mutates its inputs — so it's unit-testable without a worker/file.
 *
 *  D5: this only ever raises the POST-cascade tallies (segmento.MAESTRO, per-distributor
 *  resueltoPost/scdcPost). The distributor's raw/crudo submission never changes, so
 *  exactoCrudo/scdcCrudo (computed separately, straight from DistribuidorMetric) are left
 *  completely untouched by this function. */
export function applyMaestroRecovery(input: MaestroRecoveryInput): MaestroRecoveryResult {
  const { unresueltoPorRif, unresueltoDistRif, maestro } = input

  // The maestro can also hold estado-only entries (a client whose state resolved but whose segment
  // never did). Those recover STATES, not segments — counting them here would inflate the
  // classification rate with rows that still have no segment.
  const clasificaElSegmento = (rifKey: string): boolean => {
    const entry = maestro.get(rifKey)
    return entry != null && ((entry.segmentoN3 ?? '') !== '' || (entry.macroN1 ?? '') !== '')
  }

  let recuperados = 0
  let sinClasificar = input.segmento.SIN_CLASIFICAR
  let maestroCount = input.segmento.MAESTRO
  let tonSinClasificar = input.tonSinClasificar

  for (const [rifKey, tally] of unresueltoPorRif) {
    if (!clasificaElSegmento(rifKey)) continue
    recuperados += tally.count
    sinClasificar -= tally.count
    maestroCount += tally.count
    tonSinClasificar -= tally.ton
  }

  const recuperadosPorDist = new Map<string, number>()
  for (const [distribuidor, rifCounts] of unresueltoDistRif) {
    let total = 0
    for (const [rifKey, count] of rifCounts) {
      if (clasificaElSegmento(rifKey)) total += count
    }
    if (total > 0) recuperadosPorDist.set(distribuidor, total)
  }

  return {
    segmento: { ...input.segmento, SIN_CLASIFICAR: sinClasificar, MAESTRO: maestroCount },
    tonSinClasificar,
    recuperados,
    recuperadosPorDist,
  }
}

export interface EstadoRecoveryInput {
  estado: EstadoTally
  /** rifKey -> number of rows that ended SIN_ESTADO for that client during the stream. */
  sinEstadoPorRif: Map<string, number>
  /** rifKey -> entry, from MaestroBuilder.build(). */
  maestro: Map<string, MaestroEntry>
}

export interface EstadoRecoveryResult {
  estado: EstadoTally      // new object: SIN_ESTADO reduced, RIF increased
  recuperados: number      // total rows whose state the maestro recovered this run
}

/** The estado twin of applyMaestroRecovery: a row whose state never resolved during the stream but
 *  whose RIF turned out to have a habitual state in the maestro (because OTHER rows for that same
 *  client resolved) gets reclassified SIN_ESTADO -> RIF.
 *
 *  The pipeline pass builds the maestro from the same stream it is resolving, so it cannot apply
 *  the RIF step inline; the export pass CAN (it re-streams with the finished maestro) and does. In
 *  other words this function makes the run's reported numbers match what the exported file will
 *  actually contain. Pure and side-effect free. */
export function applyEstadoRecovery(input: EstadoRecoveryInput): EstadoRecoveryResult {
  let recuperados = 0
  for (const [rifKey, count] of input.sinEstadoPorRif) {
    const entry = input.maestro.get(rifKey)
    if (entry?.estadoHabitual) recuperados += count
  }

  return {
    estado: {
      ...input.estado,
      SIN_ESTADO: input.estado.SIN_ESTADO - recuperados,
      RIF: input.estado.RIF + recuperados,
    },
    recuperados,
  }
}
