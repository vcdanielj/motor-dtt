import type { MethodTally } from '@/contracts/pipeline'
import type { MaestroEntry } from '@/contracts/maestro'

/** Per-RIF tally of rows that stayed SIN_CLASIFICAR during the streaming pass, kept only for
 *  rows whose RIF is non-empty (those are the only ones the maestro can ever recover). */
export interface UnresueltoTally {
  count: number
  ton: number
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

  let recuperados = 0
  let sinClasificar = input.segmento.SIN_CLASIFICAR
  let maestroCount = input.segmento.MAESTRO
  let tonSinClasificar = input.tonSinClasificar

  for (const [rifKey, tally] of unresueltoPorRif) {
    if (!maestro.has(rifKey)) continue
    recuperados += tally.count
    sinClasificar -= tally.count
    maestroCount += tally.count
    tonSinClasificar -= tally.ton
  }

  const recuperadosPorDist = new Map<string, number>()
  for (const [distribuidor, rifCounts] of unresueltoDistRif) {
    let total = 0
    for (const [rifKey, count] of rifCounts) {
      if (maestro.has(rifKey)) total += count
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
