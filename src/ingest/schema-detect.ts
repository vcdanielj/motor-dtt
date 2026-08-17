import type { SchemaMap } from '@/contracts/row'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()

// Alias fragments (normalized) → internal field. Order = priority; first match wins per header.
const ALIASES: { field: 'rif' | 'segmentoCrudo' | 'estadoCrudo' | 'ciudad'; needles: string[] }[] = [
  {
    field: 'rif',
    needles: [
      'RIF',
      'CEDULA',
      'NIT',
      'RUT',
      'DOCUMENTO CLIENTE',
      'DOC CLIENTE',
      'RIF CLIENTE',
      'CODIGO RIF',
      'NUMERO RIF',
      'NRO RIF',
      'NUM RIF',
      'ID FISCAL',
      'REGISTRO FISCAL',
      'DOCUMENTO FISCAL',
      'DOC FISCAL',
      'IDENTIFICACION',
      'IDENTIFICADOR',
      'ID CLIENTE',
      'DOCUMENTO',
      'DOC IDENTIDAD',
    ],
  },
  {
    field: 'segmentoCrudo',
    needles: [
      'CANAL',
      'SUBCANAL',
      'SUB CANAL',
      'TIPO DE CLIENTE',
      'TIPO CLIENTE',
      'TIPO DE NEGOCIO',
      'TIPO NEGOCIO',
      'TIPO DE TIENDA',
      'TIPO TIENDA',
      'SEGMENTO',
      'SEGMENTO CLIENTE',
      'SEGMENTO N3',
      'FORMATO',
      'FORMATO COMERCIAL',
      'GIRO',
      'RUBRO',
      'CLASIFICACION',
      'CATEGORIA CLIENTE',
      'CATEGORIA DE CLIENTE',
      'CATEGORIA',
      'CANAL VENTA',
      'CANAL DE DISTRIBUCION',
      'RAMO',
      'ACTIVIDAD',
      'PERFIL',
      'CLASE',
      'TIPO ESTABLECIMIENTO',
    ],
  },
  {
    field: 'estadoCrudo',
    needles: [
      'ESTADO',
      'EDO',
      'ENTIDAD',
      'ENTIDAD FEDERAL',
      'REGION',
      'DEPARTAMENTO',
      'PROVINCIA',
      'ESTADO DESTINO',
      'ESTADO ENTREGA',
      'ESTADO DESPACHO',
      'ESTADO GEOGRAFICO',
      'UBICACION ESTADO',
    ],
  },
  {
    field: 'ciudad',
    needles: [
      'CIUDAD',
      'MUNICIPIO',
      'LOCALIDAD',
      'POBLACION',
      'PARROQUIA',
      'CIUDAD DESTINO',
      'CIUDAD ENTREGA',
      'CIUDAD CLIENTE',
      'MUNICIPIO CLIENTE',
      'UBICACION',
      'ZONA',
      'ZONA GEOGRAFICA',
      'SECTOR',
      'DISTRITO',
      'PLAZA',
      'SEDE',
      'LOCALIDAD DESTINO',
    ],
  },
]

// Headers that contain the word ESTADO but mean something entirely different.
const ESTADO_FALSOS_AMIGOS = [
  'ESTADO DEL PEDIDO',
  'ESTADO PEDIDO',
  'ESTADO DE PEDIDO',
  'ESTADO CIVIL',
  'ESTADO DEL CLIENTE',
  'ESTADO CLIENTE',
  'ESTADO DE LA FACTURA',
  'ESTADO FACTURA',
  'ESTADO DOCUMENTO',
  'ESTADO DE CUENTA',
  'ESTADO CUENTA',
  'ESTADO REGISTRO',
  'ESTATUS',
  'ESTATUS PEDIDO',
  'ESTATUS FACTURA',
  'ESTATUS CLIENTE',
]

// Headers in pivot tables/aggregations that contain RIF but are counts/aggregates, not client IDs.
const RIF_FALSOS_AMIGOS = [
  'DISTINCT COUNT OF RIF',
  'COUNT OF RIF',
  'SUM OF RIF',
  'TOTAL RIF',
  'CONTEO DE RIF',
  'CANTIDAD DE RIF',
  'RECUENTO DE RIF',
  'TOTAL DE RIF',
  'COUNT RIF',
  'SUM RIF',
  'TOTAL DE RIFS',
]

const hasWord = (n: string, needle: string) => ` ${n} `.includes(` ${needle} `)

export function detectSchema(headers: string[]): SchemaMap {
  const map: SchemaMap = {
    rif: null,
    segmentoCrudo: null,
    estadoCrudo: null,
    ciudad: null,
    codigoCliente: null,
    sucursal: null,
    passthrough: [],
    unmapped: [],
  }
  for (const h of headers) {
    const n = norm(h)
    if (ESTADO_FALSOS_AMIGOS.some((f) => hasWord(n, f) || n === f)) {
      map.unmapped.push(h)
      continue
    }
    if (RIF_FALSOS_AMIGOS.some((f) => hasWord(n, f) || n.includes(f))) {
      map.unmapped.push(h)
      continue
    }
    const hit = ALIASES.find((a) => a.needles.some((needle) => hasWord(n, needle)))
    if (hit && map[hit.field] === null) {
      map[hit.field] = h
      continue
    }
    // Check for client code column (when different from RIF)
    if (!map.codigoCliente && /(COD|CODIGO|ID)\s*(CLIENTE|CTA|LOCAL|CLI|COMPRADOR)/.test(n) && !/(RIF|CEDULA|DOC)/.test(n)) {
      map.codigoCliente = h
      continue
    }
    // Check for branch / sucursal column
    if (!map.sucursal && /(SUCURSAL|AGENCIA|SEDE|PUNTO DE VENTA|NOMBRE SUCURSAL|COD SUCURSAL)/.test(n) && !/(DISTRIBUIDOR|MAYORISTA)/.test(n)) {
      map.sucursal = h
      continue
    }
    // known money/date/volume passthroughs
    if (/(CAJAS|BS|BOLIVARES|TON|TONELADAS|UNIDADES|FECHA|MES|MONTO|VENTA|PRECIO|IMPORTE|NETO|BRUTO|CANTIDAD|PACKS|KILOS|KG)/.test(n)) {
      map.passthrough.push(h)
      continue
    }
    map.unmapped.push(h)
  }
  return map
}

/** Determines if a detected schema has enough usable columns to process rows. */
export function schemaIsUsable(s: SchemaMap | null): boolean {
  if (!s) return false
  return s.rif !== null || s.segmentoCrudo !== null || s.estadoCrudo !== null
}

/** Determines if a sheet is an actual transactional data sheet. */
export function isDataSheetSchema(s: SchemaMap | null): boolean {
  if (!s) return false
  return s.rif !== null && (s.segmentoCrudo !== null || s.estadoCrudo !== null || s.ciudad !== null)
}

/** Finds the distributor column, strictly prioritizing textual names over numeric codes (Audio 1). */
export function detectDistCol(headers: string[]): string | null {
  const clean = headers.map((h) => ({ original: h, n: norm(h) }))
  const hasCodeIndicator = (n: string) => /\b(COD|CODIGO|ID|JDE|CVE|NUM|NRO|ENTREGA|DIR)\b/.test(n)

  // 1. Explicit textual name / description / mayorista / sucursal
  const byExplicitName = clean.find(
    (c) =>
      (c.n === 'NOMBRE DISTRIBUIDOR' ||
        c.n === 'DISTRIBUIDOR NOMBRE' ||
        c.n === 'RAZON SOCIAL DISTRIBUIDOR' ||
        c.n === 'DESCRIPCION DISTRIBUIDOR' ||
        c.n === 'DISTRIBUIDOR' ||
        c.n === 'MAYORISTA' ||
        c.n === 'DIST' ||
        c.n === 'NOMBRE MAYORISTA') &&
      !hasCodeIndicator(c.n)
  )
  if (byExplicitName) return byExplicitName.original

  // 2. Contains name keywords without code indicators
  const byName = clean.find(
    (c) =>
      (c.n.includes('DISTRIBUIDOR') || c.n.includes('MAYORISTA') || c.n.includes('AGENCIA')) &&
      !hasCodeIndicator(c.n)
  )
  if (byName) return byName.original

  // 3. Any distributor header except JDE/Entrega
  const byRegexNoJde = headers.find((h) => /distribuidor/i.test(h) && !/jde/i.test(h) && !/entrega/i.test(h))
  if (byRegexNoJde) return byRegexNoJde

  // 4. Fallback
  return headers.find((h) => /distribuidor/i.test(h)) ?? null
}

/** Finds the internal client code column (distributor-specific client ID). */
export function detectCodigoClienteCol(headers: string[]): string | null {
  const clean = headers.map((h) => ({ original: h, n: norm(h) }))
  const hit = clean.find(
    (c) =>
      (c.n === 'COD CLIENTE' ||
        c.n === 'CODIGO CLIENTE' ||
        c.n === 'CODIGO DEL CLIENTE' ||
        c.n === 'COD CLI' ||
        c.n === 'CODIGO CLI' ||
        c.n === 'ID CLIENTE' ||
        c.n === 'ID_CLIENTE' ||
        c.n === 'COD_CLIENTE' ||
        c.n === 'CODIGO' ||
        c.n === 'COD_LOCAL') &&
      !c.n.includes('RIF') &&
      !c.n.includes('CEDULA') &&
      !c.n.includes('DIST')
  )
  return hit ? hit.original : null
}

/** Finds the branch / sucursal column. */
export function detectSucursalCol(headers: string[]): string | null {
  const clean = headers.map((h) => ({ original: h, n: norm(h) }))
  const hit = clean.find(
    (c) =>
      (c.n === 'SUCURSAL' ||
        c.n === 'NOMBRE SUCURSAL' ||
        c.n === 'SEDE' ||
        c.n === 'AGENCIA' ||
        c.n === 'TIENDA' ||
        c.n === 'COD SUCURSAL' ||
        c.n === 'PUNTO DE VENTA') &&
      !c.n.includes('DISTRIBUIDOR') &&
      !c.n.includes('MAYORISTA')
  )
  return hit ? hit.original : null
}

/** Finds the client name / razon social column, strictly prioritizing descriptive names over codes (Audio 1). */
export function detectClienteCol(headers: string[]): string | null {
  const clean = headers.map((h) => ({ original: h, n: norm(h) }))

  // 1. Exact or composite name/razon social without code/rif/doc needles
  const byName = clean.find(
    (c) =>
      (c.n === 'CLIENTE' ||
        c.n === 'RAZON SOCIAL' ||
        c.n === 'RAZON' ||
        c.n === 'RAZON SOCIAL CLIENTE' ||
        c.n === 'NOMBRE CLIENTE' ||
        c.n === 'NOMBRE DEL CLIENTE' ||
        c.n === 'CLIENTE NOMBRE' ||
        c.n === 'NOMBRE NEGOCIO' ||
        c.n === 'NOMBRE COMERCIAL' ||
        c.n === 'NOMBRE TIENDA' ||
        c.n === 'DENOMINACION COMERCIAL' ||
        c.n === 'ESTABLECIMIENTO' ||
        c.n === 'PDV' ||
        c.n === 'NOMBRE PDV' ||
        c.n === 'DESTINATARIO') &&
      !c.n.includes('COD') &&
      !c.n.includes('ID') &&
      !c.n.includes('RIF') &&
      !c.n.includes('CEDULA') &&
      !c.n.includes('DOCUMENTO') &&
      !c.n.includes('DOC') &&
      !c.n.includes('NRO') &&
      !c.n.includes('NUM')
  )
  if (byName) return byName.original

  // 2. Broader match containing CLIENTE or RAZON without code/id/rif/doc
  const byBroad = clean.find(
    (c) =>
      (c.n.includes('CLIENTE') || c.n.includes('RAZON') || c.n.includes('ESTABLECIMIENTO') || c.n.includes('PDV')) &&
      !c.n.includes('COD') &&
      !c.n.includes('ID') &&
      !c.n.includes('RIF') &&
      !c.n.includes('CEDULA') &&
      !c.n.includes('DOCUMENTO') &&
      !c.n.includes('DOC') &&
      !c.n.includes('NRO') &&
      !c.n.includes('NUM') &&
      !c.n.includes('TIPO') &&
      !c.n.includes('CANAL') &&
      !c.n.includes('ESTADO') &&
      !c.n.includes('CATEGORIA')
  )
  if (byBroad) return byBroad.original

  return headers.find((h) => norm(h) === 'CLIENTE') ?? null
}

/** Finds the MES or FECHA column. */
export function detectMesCol(headers: string[]): string | null {
  const clean = headers.map((h) => ({ original: h, n: norm(h) }))

  const byExact = clean.find((c) => c.n === 'MES' || c.n === 'PERIODO' || c.n === 'FECHA' || c.n === 'DATE' || c.n === 'MONTH')
  if (byExact) return byExact.original

  const byContains = clean.find((c) => (c.n.includes('FECHA') || c.n.includes('MES') || c.n.includes('PERIODO')) && !c.n.includes('VENCIMIENTO'))
  if (byContains) return byContains.original

  return null
}

/** Finds the TON column. */
export function detectTonCol(headers: string[]): string | null {
  const clean = headers.map((h) => ({ original: h, n: norm(h) }))

  const byExact = clean.find((c) => c.n === 'TON' || c.n === 'TONELADAS' || c.n === 'TONS' || c.n === 'TM')
  if (byExact) return byExact.original

  const byContains = clean.find((c) => (c.n.includes('TON') || c.n.includes('VOLUMEN') || c.n.includes('PESO')) && !c.n.includes('TIPO'))
  if (byContains) return byContains.original

  return null
}

export interface HeaderEvaluation {
  headerRowIdx: number
  headers: string[]
  schema: SchemaMap
  score: number
}

/** Evaluates a candidate header row and computes a quality score. */
export function scoreHeaderRow(headers: string[]): { score: number; schema: SchemaMap } {
  const schema = detectSchema(headers)
  let score = 0

  if (schema.rif) score += 20
  if (schema.segmentoCrudo) score += 15
  if (schema.estadoCrudo) score += 15
  if (schema.ciudad) score += 8
  if (detectDistCol(headers)) score += 6
  if (detectClienteCol(headers)) score += 6
  if (detectTonCol(headers)) score += 5
  if (detectMesCol(headers)) score += 5

  const nonEmpty = headers.filter((h) => String(h ?? '').trim() !== '')
  if (nonEmpty.length >= 3) score += Math.min(nonEmpty.length, 10)

  // Penalize if it contains pivot aggregate markers or very few non-empty cells
  const joined = headers.map(norm).join(' ')
  if (/DISTINCT COUNT|ROW LABELS|COLUMN LABELS|GRAND TOTAL/.test(joined)) {
    score -= 30
  }

  return { score, schema }
}

/** Scans the top rows of a matrix (e.g. from XLSX or CSV) to find the best header row,
 *  skipping company letterhead (membrete), logos, titles, blank rows, and notes. */
export function findBestHeaderRow(matrix: unknown[][], maxScanRows = 50): HeaderEvaluation | null {
  if (!matrix || matrix.length === 0) return null

  const limit = Math.min(matrix.length, maxScanRows)
  let best: HeaderEvaluation | null = null

  for (let r = 0; r < limit; r++) {
    const row = matrix[r]
    if (!row || !Array.isArray(row)) continue
    const candHeaders = row.map((c) => String(c ?? '').trim())
    if (candHeaders.filter(Boolean).length < 2) continue

    const { score, schema } = scoreHeaderRow(candHeaders)
    if (schemaIsUsable(schema) && score > 0) {
      if (!best || score > best.score) {
        best = {
          headerRowIdx: r,
          headers: candHeaders,
          schema,
          score,
        }
      }
    }
  }

  return best
}
