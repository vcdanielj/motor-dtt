/**
 * KRAFT HEINZ VENEZUELA — PROGRAMA DE ESTANDARIZACIÓN DTT
 * @module contracts/row
 * @author Ing. José Daniel Vergara <Chief Systems Architect>
 * @copyright 2026 Kraft Heinz / Ing. José Daniel Vergara. All Rights Reserved.
 *
 * PROPRIETARY CONTRACT SPECIFICATION:
 * Define el esquema canónico de datos transaccionales de Sell-Out,
 * las 11 columnas de contrato estándar y los flags de trazabilidad forense.
 */

export const OUTPUT_COLUMNS = [
  'segmento_n3_std',
  'macro_canal_n1_std',
  'metodo_segmento',
  'confianza_segmento',
  'estado_std',
  'metodo_estado',
  'flag_registro',
  'valor_original_segmento',
  'valor_original_estado',
  'version_diccionario',
  'run_id',
] as const;

export type OutputColumnName = (typeof OUTPUT_COLUMNS)[number];

export type MetodoSegmento =
  | 'DICCIONARIO'
  | 'FUZZY'
  | 'MAESTRO_RIF'
  | 'COLA_REVISION'
  | 'SIN_CLASIFICAR';

export type ConfianzaSegmento = 'HIGH' | 'MEDIUM' | 'MACRO' | 'LOW';

export type MetodoEstado =
  | 'DIRECTO'
  | 'RECUPERADO_RIF'
  | 'GEO_PARSER_CIUDAD'
  | 'SIN_ESTADO';

export type FlagRegistro =
  | 'OK'
  | 'SIN_CLASIFICAR'
  | 'SIN_ESTADO'
  | 'CONFLICTO_MAYOR'
  | 'DUPLICADO';

/** Estructura canónica de una fila extraída mediante Schema Mapping */
export interface RawRowPayload {
  readonly rif: string | null;
  readonly razonSocial: string | null;
  readonly segmentoCrudo: string | null;
  readonly estadoCrudo: string | null;
  readonly ciudadCruda: string | null;
  readonly fechaTransaccion: string | null;
  readonly kilos: number;
  readonly cajas: number;
  readonly montoUSD: number;
  readonly montoVES: number;
  readonly distribuidorId: string;
}

/** Fila estandarizada y resuelta con trazabilidad determinística */
export interface ResolvedRowContract {
  readonly segmentoN3: string | null;
  readonly macroN1: string | null;
  readonly metodoSegmento: MetodoSegmento;
  readonly confianzaSegmento: ConfianzaSegmento;
  readonly estadoStd: string | null;
  readonly metodoEstado: MetodoEstado;
  readonly flagRegistro: FlagRegistro;
  readonly hashSHA256: string;
  readonly valorOriginalSegmento: string;
  readonly valorOriginalEstado: string;
  readonly versionDiccionario: string;
  readonly runId: string;
}
