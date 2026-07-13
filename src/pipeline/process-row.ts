import { OUTPUT_COLUMNS } from '@/contracts/row'
import type { MetodoSegmento, ConfianzaSegmento, MetodoEstado, FlagRegistro } from '@/contracts/row'
import { resolveSegmento, type SegmentoContext } from './segmento'
import { resolveEstado, type EstadoContext } from './estado'

/** Field values already extracted from the raw row via the SchemaMap. */
export interface RowFields {
  rif: string | null
  segmentoCrudo: string | null
  estadoCrudo: string | null
  ciudad: string | null
}

export interface ResolvedRow {
  segmentoN3: string | null
  macroN1: string | null
  metodoSegmento: MetodoSegmento
  confianzaSegmento: ConfianzaSegmento
  estadoStd: string | null
  metodoEstado: MetodoEstado
  flagRegistro: FlagRegistro // see precedence below
  sugerenciaSegmento: { segmentoN3: string; macroN1: string; score: number } | null
  valorOriginalSegmento: string // raw segmentoCrudo (unaltered, '' if null)
  valorOriginalEstado: string // raw estadoCrudo (unaltered, '' if null)
}

/** Resolve one schema-mapped row through the segmento + estado cascades and combine
 *  into a single ResolvedRow (PRD §7.3). Pure, never throws. */
export function processRow(fields: RowFields, seg: SegmentoContext, est: EstadoContext): ResolvedRow {
  const segResult = resolveSegmento({ rif: fields.rif, crudo: fields.segmentoCrudo }, seg)
  const estResult = resolveEstado(
    { rif: fields.rif, ciudad: fields.ciudad, estadoCrudo: fields.estadoCrudo },
    est,
  )

  // flagRegistro precedence (single value): SIN_CLASIFICAR > SIN_ESTADO > OK.
  // DUPLICADO/CONFLICTO_MAYOR are assigned elsewhere (dedup pass / maestro), not here.
  const flagRegistro: FlagRegistro =
    segResult.flag === 'SIN_CLASIFICAR'
      ? 'SIN_CLASIFICAR'
      : estResult.flag === 'SIN_ESTADO'
        ? 'SIN_ESTADO'
        : 'OK'

  return {
    segmentoN3: segResult.segmentoN3,
    macroN1: segResult.macroN1,
    metodoSegmento: segResult.metodo,
    confianzaSegmento: segResult.confianza,
    estadoStd: estResult.estadoStd,
    metodoEstado: estResult.metodo,
    flagRegistro,
    sugerenciaSegmento: segResult.sugerencia,
    valorOriginalSegmento: fields.segmentoCrudo ?? '',
    valorOriginalEstado: fields.estadoCrudo ?? '',
  }
}

/** Emit the PRD §7.3 output columns as a plain object (used by the writer later). */
export function outputColumns(
  r: ResolvedRow,
  versionDiccionario: string,
  runId: string,
): Record<(typeof OUTPUT_COLUMNS)[number], string> {
  return {
    segmento_n3_std: r.segmentoN3 ?? '',
    macro_canal_n1_std: r.macroN1 ?? '',
    metodo_segmento: r.metodoSegmento ?? '',
    confianza_segmento: r.confianzaSegmento ?? '',
    estado_std: r.estadoStd ?? '',
    metodo_estado: r.metodoEstado ?? '',
    flag_registro: r.flagRegistro,
    valor_original_segmento: r.valorOriginalSegmento,
    valor_original_estado: r.valorOriginalEstado,
    version_diccionario: versionDiccionario,
    run_id: runId,
  }
}
