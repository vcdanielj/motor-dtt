// Pure building blocks for the standardized-base CSV export (Sprint 2 · X1). The worker's
// `mode:'export'` branch streams the file twice and drives these per row: Pass A observes
// EXACTO/FUZZY rows into a MaestroBuilder (seeds only), Pass B resolves each row WITH the
// full built maestro and serializes it. Kept pure (no DOM, no streaming) so the recovery
// behaviour — recovered RIFs must come out MAESTRO, uncapped — is directly unit-testable.
import { MaestroBuilder, parseFechaOrden } from '@/pipeline/maestro'
import { resolveSegmento, type SegmentoContext } from '@/pipeline/segmento'
import { processRow, outputColumns } from '@/pipeline/process-row'
import { resolveEstado, type EstadoContext } from '@/pipeline/estado'
import { csvLine } from './csv'
import { OUTPUT_COLUMNS, type SchemaMap } from '@/contracts/row'
import { detectClienteCol, detectMesCol } from '@/ingest/schema-detect'

const OUTPUT_HEADER = [...OUTPUT_COLUMNS]

/** Header line: the original headers (verbatim) + the 11 PRD §7.3 output column names. */
export function exportHeaderLine(headers: string[]): string {
  return csvLine([...headers, ...OUTPUT_HEADER])
}

/** Extra columns the maestro build reads (recency + client name), mirroring the pipeline branch. */
export interface ExportExtraCols {
  mesCol: string | null
  clienteCol: string | null
}

export function detectExportExtraCols(headers: string[]): ExportExtraCols {
  return {
    mesCol: detectMesCol(headers),
    clienteCol: detectClienteCol(headers),
  }
}

/** Pass A: observe an EXACTO/FUZZY row into the maestro builder. Segment is resolved with seeds
 *  only (maestro empty) — identical to the pipeline branch's observation, so the export's maestro
 *  matches the run's. Non-classifying rows contribute nothing. */
export function observeExportRow(
  builder: MaestroBuilder,
  rec: Record<string, string>,
  schema: SchemaMap,
  cols: ExportExtraCols,
  segSeed: SegmentoContext,
  estSeed?: EstadoContext,
): void {
  const segCrudo = (schema.segmentoCrudo ? rec[schema.segmentoCrudo] : '') ?? ''
  const estCrudo = (schema.estadoCrudo ? rec[schema.estadoCrudo] : '') ?? ''
  const rif = (schema.rif ? rec[schema.rif] : '') ?? ''
  const ciudad = (schema.ciudad ? rec[schema.ciudad] : '') ?? ''

  const segR = resolveSegmento({ rif: null, crudo: segCrudo }, segSeed)
  const estR = estSeed
    ? resolveEstado({ rif, ciudad, estadoCrudo: estCrudo }, estSeed)
    : { estadoStd: null }

  if (segR.metodo === 'EXACTO' || segR.metodo === 'FUZZY') {
    builder.observe({
      rif,
      segmentoN3: segR.segmentoN3 ?? '',
      macroN1: segR.macroN1 ?? '',
      metodo: segR.metodo,
      fechaOrden: cols.mesCol ? parseFechaOrden(rec[cols.mesCol]) : null,
      razonSocial: cols.clienteCol ? rec[cols.clienteCol] : null,
      estadoStd: estR.estadoStd,
    })
  } else if (estR.estadoStd) {
    builder.observe({
      rif,
      segmentoN3: '',
      macroN1: '',
      metodo: null,
      fechaOrden: null,
      razonSocial: cols.clienteCol ? rec[cols.clienteCol] : null,
      estadoStd: estR.estadoStd,
    })
  }
}

/** Pass B: resolve one row WITH the full maestro applied (so a RIF-recovered row comes out
 *  MAESTRO) and serialize the original columns (in header order) + the 11 output columns as a
 *  single CSV line. */
export function exportRowLine(
  rec: Record<string, string>,
  headers: string[],
  schema: SchemaMap,
  seg: SegmentoContext,
  est: EstadoContext,
  versionDiccionario: string,
  runId: string,
): string {
  const segCrudo = (schema.segmentoCrudo ? rec[schema.segmentoCrudo] : '') ?? ''
  const estCrudo = (schema.estadoCrudo ? rec[schema.estadoCrudo] : '') ?? ''
  const rif = (schema.rif ? rec[schema.rif] : '') ?? ''
  const ciudad = (schema.ciudad ? rec[schema.ciudad] : '') ?? ''
  const resolved = processRow({ rif, segmentoCrudo: segCrudo, estadoCrudo: estCrudo, ciudad }, seg, est)
  const outCols = outputColumns(resolved, versionDiccionario, runId)
  const rowValues = headers.map((h) => rec[h] ?? '')
  const outValues = OUTPUT_HEADER.map((c) => outCols[c])
  return csvLine([...rowValues, ...outValues])
}
