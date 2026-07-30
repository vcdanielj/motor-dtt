// The distributor-facing client template: the sheet Heinz sends out so a distributor can fill in
// the segment and/or the state of the clients the motor could not resolve, and the parser that
// reads it back. Both live here, side by side, so the round trip cannot drift — the layout is
// styled (title + subtitle rows above the header row), which is exactly what broke the previous
// importer's "headers are on row 1" assumption.
import ExcelJS from 'exceljs'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import type { ClientesSinClasificarRow } from '@/contracts/pipeline'
import type { SegmentoSeed } from '@/contracts/config'

export const HOJA_CLIENTES = 'Clasificación de Tiendas'
export const HOJA_SEGMENTOS = 'Manual de Segmentos'
export const HOJA_ESTADOS = 'Catálogo de Estados'

export const TEMPLATE_HEADERS = [
  'Distribuidor', 'RIF', 'Razón Social', 'Falta', 'Tipo de Tienda', 'Estado',
] as const

// 1-based sheet geometry of the styled template. FILA_ENCABEZADO is what the parser has to find
// on its own (it scans, rather than trusting this constant, so a hand-edited file still imports).
const FILA_ENCABEZADO = 4
const PRIMERA_FILA_DATOS = FILA_ENCABEZADO + 1

const HEINZ = 'FF8A1538'
const HEINZ_SUAVE = 'FFFFF0F2'
const CEBRA = 'FFFBF7F8'
const BORDE = 'FFD3D3D3'

/** Human-readable summary of what this client is missing, shown to the distributor. */
export function etiquetaFalta(row: Pick<ClientesSinClasificarRow, 'faltaSegmento' | 'faltaEstado'>): string {
  if (row.faltaSegmento && row.faltaEstado) return 'Segmento y Estado'
  if (row.faltaSegmento) return 'Segmento'
  return 'Estado'
}

function estiloEncabezado(cell: ExcelJS.Cell, size = 10) {
  cell.font = { name: 'Arial', size, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEINZ } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

/** Sheet 2: the segment reference the "Tipo de Tienda" dropdown points at.
 *  Returns the last populated row so the caller can build the validation range. */
function escribirHojaSegmentos(ws: ExcelJS.Worksheet, segmentos: SegmentoSeed[]): number {
  ws.mergeCells('A1:B1')
  const titulo = ws.getCell('A1')
  titulo.value = 'MANUAL DE REFERENCIA DE SEGMENTOS'
  estiloEncabezado(titulo, 12)
  ws.getRow(1).height = 30

  ws.getCell('A3').value = 'Segmento (Tipo de Tienda)'
  ws.getCell('B3').value = 'Macro Canal'
  estiloEncabezado(ws.getCell('A3'))
  estiloEncabezado(ws.getCell('B3'))
  ws.getRow(3).height = 20

  let fila = 4
  for (const seg of segmentos) {
    ws.getCell(`A${fila}`).value = seg.n3
    ws.getCell(`B${fila}`).value = seg.macroN1
    for (const col of ['A', 'B']) {
      const cell = ws.getCell(`${col}${fila}`)
      cell.font = { name: 'Arial', size: 10 }
      cell.border = { bottom: { style: 'thin', color: { argb: BORDE } } }
    }
    fila++
  }
  ws.columns = [{ key: 'segmento', width: 35 }, { key: 'macro', width: 35 }]
  return fila - 1
}

/** Sheet 3: the 24 official estados the "Estado" dropdown points at. Returns the last row. */
function escribirHojaEstados(ws: ExcelJS.Worksheet, estados: string[]): number {
  const titulo = ws.getCell('A1')
  titulo.value = 'CATÁLOGO OFICIAL DE ESTADOS'
  estiloEncabezado(titulo, 12)
  ws.getRow(1).height = 30

  ws.getCell('A3').value = 'Estado'
  estiloEncabezado(ws.getCell('A3'))
  ws.getRow(3).height = 20

  let fila = 4
  for (const estado of estados) {
    const cell = ws.getCell(`A${fila}`)
    cell.value = estado
    cell.font = { name: 'Arial', size: 10 }
    cell.border = { bottom: { style: 'thin', color: { argb: BORDE } } }
    fila++
  }
  ws.columns = [{ key: 'estado', width: 35 }]
  return fila - 1
}

/** Builds the full styled workbook for one distributor: the client sheet plus the two reference
 *  sheets its dropdowns validate against. Pure (no DOM, no file system) so the round trip is
 *  directly unit-testable. */
export function buildClientesWorkbook(
  clientes: ClientesSinClasificarRow[],
  segmentos: SegmentoSeed[],
  estados: string[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const ws1 = workbook.addWorksheet(HOJA_CLIENTES)
  const ws2 = workbook.addWorksheet(HOJA_SEGMENTOS)
  const ws3 = workbook.addWorksheet(HOJA_ESTADOS)

  const ultimaFilaSegmentos = escribirHojaSegmentos(ws2, segmentos)
  const ultimaFilaEstados = escribirHojaEstados(ws3, estados)

  ws1.mergeCells('A1:F1')
  const titulo = ws1.getCell('A1')
  titulo.value = 'HEINZ - CLASIFICACIÓN DE CLIENTES'
  estiloEncabezado(titulo, 14)
  ws1.getRow(1).height = 35

  ws1.mergeCells('A2:F2')
  const subtitulo = ws1.getCell('A2')
  subtitulo.value =
    'Complete las columnas "Tipo de Tienda" y "Estado" usando las listas desplegables. La columna "Falta" indica qué dato necesitamos de cada cliente; lo que ya viene lleno puede dejarse como está.'
  subtitulo.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF555555' } }
  subtitulo.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  subtitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEINZ_SUAVE } }
  ws1.getRow(2).height = 28

  TEMPLATE_HEADERS.forEach((h, idx) => {
    const cell = ws1.getRow(FILA_ENCABEZADO).getCell(idx + 1)
    cell.value = h
    estiloEncabezado(cell)
  })
  ws1.getRow(FILA_ENCABEZADO).height = 25

  let fila = PRIMERA_FILA_DATOS
  for (const cliente of clientes) {
    ws1.getCell(`A${fila}`).value = cliente.distribuidor
    ws1.getCell(`B${fila}`).value = cliente.rif
    ws1.getCell(`C${fila}`).value = cliente.razonSocial
    ws1.getCell(`D${fila}`).value = etiquetaFalta(cliente)
    // Pre-fill what the motor already knows, so the distributor only has to answer what's missing.
    ws1.getCell(`E${fila}`).value = cliente.faltaSegmento ? '' : cliente.segmentoActual
    ws1.getCell(`F${fila}`).value = cliente.faltaEstado ? '' : cliente.estadoActual

    for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const cell = ws1.getCell(`${col}${fila}`)
      cell.font = { name: 'Arial', size: 10 }
      cell.border = {
        bottom: { style: 'thin', color: { argb: BORDE } },
        left: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        right: { style: 'thin', color: { argb: 'FFE5E5E5' } },
      }
      if (fila % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CEBRA } }
    }

    ws1.getCell(`E${fila}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'${HOJA_SEGMENTOS}'!$A$4:$A$${ultimaFilaSegmentos}`],
    }
    ws1.getCell(`F${fila}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'${HOJA_ESTADOS}'!$A$4:$A$${ultimaFilaEstados}`],
    }

    fila++
  }

  ws1.columns = [
    { key: 'distribuidor', width: 25 },
    { key: 'rif', width: 16 },
    { key: 'razonSocial', width: 40 },
    { key: 'falta', width: 18 },
    { key: 'tipoTienda', width: 32 },
    { key: 'estado', width: 22 },
  ]

  return workbook
}

// ── Parsing ────────────────────────────────────────────────────────────────────────────────────

const normHeader = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

const ALIAS_RIF = ['rif', 'numeroderif', 'nrif', 'cedula', 'rifcliente']
const ALIAS_SEGMENTO = ['tipodetienda', 'segmentodetienda', 'tipo', 'segmento', 'segmenton3', 'canal']
const ALIAS_ESTADO = ['estado', 'estadofederal', 'estadostd', 'edo']
const ALIAS_RAZON = ['razonsocial', 'nombre', 'nombrecliente', 'cliente', 'razon']

/** How many leading rows to scan for the header row. The styled template puts it on row 4; the
 *  slack covers a distributor who inserts a logo or a note above it. */
const MAX_FILAS_BUSQUEDA_ENCABEZADO = 15

export interface PlantillaColumnas {
  headerRow: number      // 0-based index into the matrix
  rif: number
  segmento: number | null
  estado: number | null
  razonSocial: number | null
}

/** Finds the header row and the column positions in a sheet read as a raw matrix.
 *
 *  This is the fix for the broken round trip: the exported template has its headers on row 4 (a
 *  title and a subtitle sit above them), so reading the sheet as objects keyed by row 1 produced
 *  garbage keys and imported nothing. Scanning for the row that actually carries a RIF header
 *  handles the styled template, the flat one, and a hand-edited file alike.
 *
 *  Returns null when no row in the scanned window carries a RIF column. */
export function detectPlantillaColumnas(matrix: string[][]): PlantillaColumnas | null {
  const limite = Math.min(matrix.length, MAX_FILAS_BUSQUEDA_ENCABEZADO)
  for (let r = 0; r < limite; r++) {
    const fila = matrix[r] ?? []
    const headers = fila.map((c) => normHeader(String(c ?? '')))
    const rif = headers.findIndex((h) => ALIAS_RIF.includes(h))
    if (rif === -1) continue

    const buscar = (alias: string[]) => {
      const i = headers.findIndex((h) => alias.includes(h))
      return i === -1 ? null : i
    }
    return {
      headerRow: r,
      rif,
      segmento: buscar(ALIAS_SEGMENTO),
      estado: buscar(ALIAS_ESTADO),
      razonSocial: buscar(ALIAS_RAZON),
    }
  }
  return null
}

export interface FilaPlantilla {
  rif: string
  segmentoCrudo: string
  estadoCrudo: string
  razonSocial: string
}

/** Reads the data rows below the detected header. Rows with no RIF are dropped (they are the blank
 *  padding Excel leaves behind); everything else is returned verbatim for the caller to validate
 *  against the catalogs. Returns null when the sheet has no recognizable header row. */
export function parsePlantillaClientes(matrix: string[][]): FilaPlantilla[] | null {
  const cols = detectPlantillaColumnas(matrix)
  if (!cols) return null

  const celda = (fila: string[], idx: number | null) =>
    idx === null ? '' : String(fila[idx] ?? '').trim()

  const filas: FilaPlantilla[] = []
  for (let r = cols.headerRow + 1; r < matrix.length; r++) {
    const fila = matrix[r] ?? []
    const rif = celda(fila, cols.rif)
    if (normalizeRif(rif) === '') continue
    filas.push({
      rif,
      segmentoCrudo: celda(fila, cols.segmento),
      estadoCrudo: celda(fila, cols.estado),
      razonSocial: celda(fila, cols.razonSocial),
    })
  }
  return filas
}

/** Resolves a raw "Tipo de Tienda" cell against the segment catalog (exact match on the normalized
 *  N3 — the cell comes from a dropdown, so no fuzzy matching is warranted). */
export function matchSegmento(crudo: string, segmentos: SegmentoSeed[]): SegmentoSeed | null {
  const key = normalizeText(crudo)
  if (key === '') return null
  return segmentos.find((s) => normalizeText(s.n3) === key) ?? null
}

/** Resolves a raw "Estado" cell against the 24-estado catalog. Same reasoning as matchSegmento. */
export function matchEstado(crudo: string, estados: string[]): string | null {
  const key = normalizeText(crudo)
  if (key === '') return null
  return estados.find((e) => normalizeText(e) === key) ?? null
}
