import { normalizeText } from '@/ingest/normalize'
import type { MetodoEstado, FlagRegistro } from '@/contracts/row'

export interface EstadoResult {
  estadoStd: string | null
  metodo: MetodoEstado                 // EXACTO | RIF | CIUDAD | null
  flag: Extract<FlagRegistro, 'OK' | 'SIN_ESTADO'>
}

export interface EstadoContext {
  catalogo: Set<string>                // normalized 24 estados
  estadoByRif: Map<string, string>     // normalizeText(rif) -> canonical estado (from history; may be empty for now)
  ciudadEstado: Map<string, string>    // normalizeText(ciudad) -> canonical estado
}

/** R4: "NO IDENTIFICADO" is a prohibited value → treat as null/empty. */
export function isProhibitedEstado(normalized: string): boolean {
  return normalized === '' || normalized === 'NO IDENTIFICADO'
}

/** Build the normalized lookup context from the raw seeds (+ optional RIF history). */
export function buildEstadoContext(
  estados: string[],
  ciudadEstado: Record<string, string>,
  estadoByRif: Map<string, string> = new Map(),
): EstadoContext {
  const catalogo = new Set<string>()
  for (const e of estados) {
    const key = normalizeText(e)
    if (key === '') continue
    catalogo.add(key)
  }

  const ciudadEstadoMap = new Map<string, string>()
  for (const [ciudad, estado] of Object.entries(ciudadEstado)) {
    const key = normalizeText(ciudad)
    if (key === '') continue
    ciudadEstadoMap.set(key, estado)
  }

  const estadoByRifMap = new Map<string, string>()
  for (const [rif, estado] of estadoByRif) {
    const key = normalizeText(rif)
    if (key === '') continue
    estadoByRifMap.set(key, estado)
  }

  return { catalogo, estadoByRif: estadoByRifMap, ciudadEstado: ciudadEstadoMap }
}

function sinEstado(): EstadoResult {
  return { estadoStd: null, metodo: null, flag: 'SIN_ESTADO' }
}

/** Resolve one record via the CATALOGO -> RIF -> CIUDAD -> SIN_ESTADO cascade (PRD §6 + R4). */
export function resolveEstado(
  input: { rif: string | null; ciudad: string | null; estadoCrudo: string | null },
  ctx: EstadoContext,
): EstadoResult {
  // 1. CATALOGO (EXACTO) — normalized estadoCrudo hits the 24-estado catalog exactly.
  const e = normalizeText(input.estadoCrudo ?? '')
  if (!isProhibitedEstado(e) && ctx.catalogo.has(e)) {
    return { estadoStd: e, metodo: 'EXACTO', flag: 'OK' }
  }

  // 2. RIF — beats CIUDAD when they disagree (R4); enforced by cascade order.
  const rifKey = normalizeText(input.rif ?? '')
  if (rifKey !== '') {
    const rifEstado = ctx.estadoByRif.get(rifKey)
    if (rifEstado) {
      return { estadoStd: rifEstado, metodo: 'RIF', flag: 'OK' }
    }
  }

  // 3. CIUDAD — ciudad_estado seed lookup.
  const c = normalizeText(input.ciudad ?? '')
  if (c !== '') {
    const ciudadEstado = ctx.ciudadEstado.get(c)
    if (ciudadEstado) {
      return { estadoStd: ciudadEstado, metodo: 'CIUDAD', flag: 'OK' }
    }
  }

  // 4. SIN_ESTADO — nothing resolved.
  return sinEstado()
}
