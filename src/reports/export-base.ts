// Pure building blocks for the standardized-base CSV export (Sprint 2 · X1). The worker's
// `mode:'export'` branch streams the file twice and drives these per row: Pass A observes
// EXACTO/FUZZY rows into a MaestroBuilder (seeds only), Pass B resolves each row WITH the
// full built maestro and serializes it. Kept pure (no DOM, no streaming) so the recovery
// behaviour — recovered RIFs must come out MAESTRO, uncapped — is directly unit-testable.
import { MaestroBuilder, parseFechaOrden } from '@/pipeline/maestro'
import { resolveSegmento, type SegmentoContext } from '@/pipeline/segmento'
import { processRow, outputColumns } from '@/pipeline/process-row'
import { resolveEstado, type EstadoContext } from '@/pipeline/estado'
import { resolveAlias, type AliasIndex } from '@/pipeline/alias'
import { normalizeRif } from '@/ingest/normalize'
import { csvLine } from './csv'
import { OUTPUT_COLUMNS, type SchemaMap } from '@/contracts/row'
import type { ClienteAliasEntry } from '@/contracts/config'
import { detectClienteCol, detectMesCol, detectSucursalCol, detectCodigoClienteCol, detectDistCol } from '@/ingest/schema-detect'

const OUTPUT_HEADER = [...OUTPUT_COLUMNS]

/** Header values: the original headers (verbatim) + the 11 PRD §7.3 output column names. */
export function exportHeaderValues(headers: string[]): string[] {
  return [...headers, ...OUTPUT_HEADER]
}

/** Header line: `exportHeaderValues` serialized as one CSV line. */
export function exportHeaderLine(headers: string[]): string {
  return csvLine(exportHeaderValues(headers))
}

/** Extra columns the maestro build reads (recency, client name, sucursal, etc.). */
export interface ExportExtraCols {
  mesCol: string | null
  clienteCol: string | null
  sucursalCol: string | null
  codigoClienteCol: string | null
  distCol: string | null
}

export function detectExportExtraCols(headers: string[]): ExportExtraCols {
  return {
    mesCol: detectMesCol(headers),
    clienteCol: detectClienteCol(headers),
    sucursalCol: detectSucursalCol(headers),
    codigoClienteCol: detectCodigoClienteCol(headers),
    distCol: detectDistCol(headers),
  }
}

/** The effective RIF of a row: the raw RIF cell, or — when it is empty — the canonical RIF its
 *  distributor client code homologates to. This is the SAME rule the pipeline pass applies, so
 *  the exported file can never lose a homologation the corrida already counted. Returns the alias
 *  entry too so callers can reuse its razón social. */
export function rifConAlias(
  rec: Record<string, string>,
  schema: SchemaMap,
  cols: ExportExtraCols,
  aliasIndex?: AliasIndex,
): { rif: string; alias: ClienteAliasEntry | null } {
  const raw = (schema.rif ? rec[schema.rif] : '') ?? ''
  if (!aliasIndex || normalizeRif(raw) !== '') return { rif: raw, alias: null }
  const codigo = (cols.codigoClienteCol ? rec[cols.codigoClienteCol] : (schema.codigoCliente ? rec[schema.codigoCliente] : '')) ?? ''
  if (!codigo) return { rif: raw, alias: null }
  const distribuidor = (cols.distCol ? rec[cols.distCol] : '') ?? ''
  const alias = resolveAlias(distribuidor, codigo, aliasIndex)
  return alias ? { rif: alias.rifCanonico, alias } : { rif: raw, alias: null }
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
  aliasIndex?: AliasIndex,
): void {
  const segCrudo = (schema.segmentoCrudo ? rec[schema.segmentoCrudo] : '') ?? ''
  const estCrudo = (schema.estadoCrudo ? rec[schema.estadoCrudo] : '') ?? ''
  const { rif, alias } = rifConAlias(rec, schema, cols, aliasIndex)
  const ciudad = (schema.ciudad ? rec[schema.ciudad] : '') ?? ''
  const sucursal = cols.sucursalCol ? rec[cols.sucursalCol] : (schema.sucursal ? rec[schema.sucursal] : null)
  const razonSocial = (cols.clienteCol ? rec[cols.clienteCol] : '') || alias?.razonSocial || null

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
      razonSocial,
      estadoStd: estR.estadoStd,
      sucursal: sucursal || null,
      ciudad: ciudad || null,
    })
  } else if (estR.estadoStd) {
    builder.observe({
      rif,
      segmentoN3: '',
      macroN1: '',
      metodo: null,
      fechaOrden: null,
      razonSocial,
      estadoStd: estR.estadoStd,
      sucursal: sucursal || null,
      ciudad: ciudad || null,
    })
  }
}

/** Pass B: resolve one row WITH the full maestro applied (so a RIF-recovered row comes out
 *  MAESTRO) and return the original columns (in header order) + the 11 output columns as plain
 *  cell values — the XLSX writer consumes these directly. */
export function exportRowValues(
  rec: Record<string, string>,
  headers: string[],
  schema: SchemaMap,
  seg: SegmentoContext,
  est: EstadoContext,
  versionDiccionario: string,
  runId: string,
  cols?: ExportExtraCols,
  aliasIndex?: AliasIndex,
): string[] {
  const segCrudo = (schema.segmentoCrudo ? rec[schema.segmentoCrudo] : '') ?? ''
  const estCrudo = (schema.estadoCrudo ? rec[schema.estadoCrudo] : '') ?? ''
  const { rif } = cols
    ? rifConAlias(rec, schema, cols, aliasIndex)
    : { rif: (schema.rif ? rec[schema.rif] : '') ?? '' }
  const ciudad = (schema.ciudad ? rec[schema.ciudad] : '') ?? ''
  const resolved = processRow({ rif, segmentoCrudo: segCrudo, estadoCrudo: estCrudo, ciudad }, seg, est)
  const outCols = outputColumns(resolved, versionDiccionario, runId)
  const rowValues = headers.map((h) => rec[h] ?? '')
  const outValues = OUTPUT_HEADER.map((c) => outCols[c])
  return [...rowValues, ...outValues]
}

/** `exportRowValues` serialized as one CSV line (kept for the CSV-based tests/back-compat). */
export function exportRowLine(
  rec: Record<string, string>,
  headers: string[],
  schema: SchemaMap,
  seg: SegmentoContext,
  est: EstadoContext,
  versionDiccionario: string,
  runId: string,
  cols?: ExportExtraCols,
  aliasIndex?: AliasIndex,
): string {
  return csvLine(exportRowValues(rec, headers, schema, seg, est, versionDiccionario, runId, cols, aliasIndex))
}
