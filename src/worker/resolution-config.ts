import { normalizeText, normalizeRif } from '@/ingest/normalize'
import { SEEDS } from '@/seeds'
import { buildIndex, type SegmentoContext } from '@/pipeline/segmento'
import { buildEstadoContext, type EstadoContext } from '@/pipeline/estado'
import type { MaestroBuilder } from '@/pipeline/maestro'
import type { DiccionarioEntry, EstadoDiccionarioEntry, ClienteAliasEntry } from '@/contracts/config'
import type { MaestroEntry } from '@/contracts/maestro'

// Recency key stamped on manual classifications (from Config import or Cola resolution) so they
// win rule D3 over any observed row from the actual file.
const MANUAL_FECHA_ORDEN = Number.MAX_SAFE_INTEGER

// The 24 official estados, normalized — the gate every alias-provided estado must pass before it
// can resolve a row (an alias imported with a typo'd estado must never leak into estado_std).
const ESTADO_CATALOGO = new Set(SEEDS.estados.map(normalizeText))

/** The alias's estadoStd, canonicalized, or null when absent/not a catalog estado. */
export function estadoDeAlias(alias: ClienteAliasEntry | null): string | null {
  if (!alias?.estadoStd) return null
  const estado = normalizeText(alias.estadoStd)
  return ESTADO_CATALOGO.has(estado) ? estado : null
}

/** Estado-por-RIF conocido ANTES de leer el archivo: el estado habitual de las clasificaciones
 *  manuales persistidas y el "Estado Sugerido" de las homologaciones de código. Alimenta el paso
 *  RIF de la cascada de estados en el export (pasada A) y complementa al maestro en la pasada B. */
export function estadoByRifSeed(cfg: ResolutionConfig): Map<string, string> {
  const seedMap = new Map<string, string>()
  for (const a of cfg.aliases) {
    if (!a.activa || !a.estadoStd) continue
    const estado = normalizeText(a.estadoStd)
    const rifKey = normalizeRif(a.rifCanonico)
    if (rifKey !== '' && ESTADO_CATALOGO.has(estado)) seedMap.set(rifKey, estado)
  }
  for (const m of cfg.manualMaestro) {
    if (!m.estadoHabitual) continue
    const rifKey = normalizeRif(m.rif)
    const estado = normalizeText(m.estadoHabitual)
    if (rifKey !== '' && ESTADO_CATALOGO.has(estado)) seedMap.set(rifKey, estado)
  }
  return seedMap
}

// Everything the resolution cascades need, bundled so the pipeline and export branches take the
// same single argument instead of five positional ones that must stay in sync.
export interface ResolutionConfig {
  diccionario: DiccionarioEntry[]
  estadoDiccionario: EstadoDiccionarioEntry[]
  ciudadEstado: Record<string, string>
  manualMaestro: MaestroEntry[]
  aliases: ClienteAliasEntry[]
  fuzzyThreshold: number
  fuzzySuggestFloor: number
}

export function buildSegmentoContext(cfg: ResolutionConfig, maestro: Map<string, MaestroEntry>): SegmentoContext {
  return {
    index: buildIndex(cfg.diccionario), // merged: SEEDS.diccionario ++ learned (learned wins)
    maestro,
    fuzzyThreshold: cfg.fuzzyThreshold,
    fuzzySuggestFloor: cfg.fuzzySuggestFloor,
  }
}

export function buildEstadoCtx(cfg: ResolutionConfig, estadoByRif = new Map<string, string>()): EstadoContext {
  return buildEstadoContext(
    SEEDS.estados,
    cfg.ciudadEstado,
    estadoByRif,
    cfg.estadoDiccionario,
    cfg.fuzzyThreshold,
    cfg.fuzzySuggestFloor,
  )
}

/** The habitual estado of every client the maestro knows, keyed by normalized RIF — the input of
 *  the estado cascade's RIF step. */
export function estadoByRifFrom(maestro: Map<string, MaestroEntry>): Map<string, string> {
  const estadoByRif = new Map<string, string>()
  for (const [rKey, entry] of maestro) {
    if (entry.estadoHabitual) estadoByRif.set(rKey, entry.estadoHabitual)
  }
  return estadoByRif
}

// Pre-seeds a MaestroBuilder with the persisted manual classifications so they win D3 and recover
// their RIF's rows, whether or not the file resolved that RIF via EXACTO/FUZZY on its own.
export function seedManualMaestro(builder: MaestroBuilder, manualMaestro: MaestroEntry[]): void {
  for (const m of manualMaestro) {
    builder.observe({
      rif: m.rif,
      segmentoN3: m.segmentoN3 ?? '',
      macroN1: m.macroN1 ?? '',
      metodo: 'MANUAL',
      fechaOrden: MANUAL_FECHA_ORDEN,
      razonSocial: m.razonSocial,
      estadoStd: m.estadoHabitual,
    })
  }
}
