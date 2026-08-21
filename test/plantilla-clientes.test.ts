import 'fake-indexeddb/auto'
import { test, expect, describe, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { SEEDS } from '@/seeds'
import {
  buildClientesWorkbook, detectPlantillaColumnas, etiquetaFalta, matchEstado, matchSegmento,
  parsePlantillaClientes, HOJA_CLIENTES, HOJA_ESTADOS, HOJA_SEGMENTOS, TEMPLATE_HEADERS,
} from '@/reports/plantilla-clientes'
import type { ClientesSinClasificarRow } from '@/contracts/pipeline'
import { useStore } from '@/state/store'
import { adapters } from '@/adapters'
import JSZip from 'jszip'
import { clearLearned, getManualMaestro } from '@/storage/db'

const cliente = (over: Partial<ClientesSinClasificarRow> = {}): ClientesSinClasificarRow => ({
  distribuidor: 'DIST NORTE',
  rif: 'J-12345678-9',
  razonSocial: 'BODEGA LA ESQUINA',
  ton: 12.5,
  count: 3,
  faltaSegmento: true,
  faltaEstado: true,
  segmentoActual: '',
  estadoActual: '',
  ...over,
})

/** Reads a generated workbook back through the same path the app's importer uses. */
async function comoMatriz(workbook: ExcelJS.Workbook, hoja = HOJA_CLIENTES): Promise<string[][]> {
  const buffer = await workbook.xlsx.writeBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[hoja], { header: 1, defval: '', raw: false })
}

describe('etiquetaFalta', () => {
  test.each([
    [{ faltaSegmento: true, faltaEstado: true }, 'Segmento y Estado'],
    [{ faltaSegmento: true, faltaEstado: false }, 'Segmento'],
    [{ faltaSegmento: false, faltaEstado: true }, 'Estado'],
  ])('%o → %s', (row, esperado) => {
    expect(etiquetaFalta(row)).toBe(esperado)
  })
})

describe('buildClientesWorkbook', () => {
  test('emits the client sheet plus both reference sheets the dropdowns validate against', () => {
    const wb = buildClientesWorkbook([cliente()], SEEDS.segmentos, SEEDS.estados)
    expect(wb.worksheets.map((w) => w.name)).toEqual([HOJA_CLIENTES, HOJA_SEGMENTOS, HOJA_ESTADOS])
  })

  test('lists all 14 official segments and all 24 estados in the reference sheets', async () => {
    const wb = buildClientesWorkbook([cliente()], SEEDS.segmentos, SEEDS.estados)
    const segs = await comoMatriz(wb, HOJA_SEGMENTOS)
    const ests = await comoMatriz(wb, HOJA_ESTADOS)
    // Both reference sheets start their data on row 4 (index 3).
    expect(segs.slice(3).map((r) => r[0])).toEqual(SEEDS.segmentos.map((s) => s.n3))
    expect(ests.slice(3).map((r) => r[0])).toEqual(SEEDS.estados)
  })

  test('attaches a list validation to both the segment and the state cell', () => {
    const wb = buildClientesWorkbook([cliente()], SEEDS.segmentos, SEEDS.estados)
    const ws = wb.getWorksheet(HOJA_CLIENTES)!
    const segVal = ws.getCell('E5').dataValidation
    const estVal = ws.getCell('F5').dataValidation
    expect(segVal?.type).toBe('list')
    expect(estVal?.type).toBe('list')
    expect(segVal?.formulae?.[0]).toContain(HOJA_SEGMENTOS)
    expect(estVal?.formulae?.[0]).toBe(`'${HOJA_ESTADOS}'!$A$4:$A$${3 + SEEDS.estados.length}`)
  })

  test('pre-fills the field that is NOT missing and leaves the missing one blank', async () => {
    const wb = buildClientesWorkbook(
      [cliente({ faltaSegmento: false, segmentoActual: 'BODEGA', faltaEstado: true })],
      SEEDS.segmentos, SEEDS.estados,
    )
    const matrix = await comoMatriz(wb)
    const fila = matrix[4] // row 5, 0-based
    expect(fila[3]).toBe('Estado')     // Falta
    expect(fila[4]).toBe('BODEGA')     // Tipo de Tienda, pre-filled
    expect(fila[5]).toBe('')           // Estado, the one being asked for
  })
})

describe('detectPlantillaColumnas', () => {
  test('finds the header row of the styled template (row 4, not row 1)', async () => {
    const wb = buildClientesWorkbook([cliente()], SEEDS.segmentos, SEEDS.estados)
    const cols = detectPlantillaColumnas(await comoMatriz(wb))
    expect(cols).not.toBeNull()
    expect(cols!.headerRow).toBe(3) // 0-based index of row 4
    expect(cols).toMatchObject({ rif: 1, razonSocial: 2, segmento: 4, estado: 5 })
  })

  test('still finds a flat sheet whose headers are on row 1', () => {
    const cols = detectPlantillaColumnas([[...TEMPLATE_HEADERS], ['D', 'J-1', 'X', 'Segmento', '', '']])
    expect(cols).toMatchObject({ headerRow: 0, rif: 1 })
  })

  test('returns null when no row carries a RIF column', () => {
    expect(detectPlantillaColumnas([['a', 'b'], ['1', '2']])).toBeNull()
  })
})

describe('round trip: generate → fill → parse', () => {
  test('a filled styled template parses back into the rows that were written', async () => {
    const wb = buildClientesWorkbook(
      [
        cliente({ rif: 'J-1', razonSocial: 'UNO' }),
        cliente({ rif: 'J-2', razonSocial: 'DOS', faltaSegmento: false, segmentoActual: 'Bodegas' }),
      ],
      SEEDS.segmentos, SEEDS.estados,
    )
    // The distributor fills in the blanks.
    const ws = wb.getWorksheet(HOJA_CLIENTES)!
    ws.getCell('E5').value = 'Abastos'
    ws.getCell('F5').value = 'ZULIA'
    ws.getCell('F6').value = 'MIRANDA'

    const filas = parsePlantillaClientes(await comoMatriz(wb))
    expect(filas).toEqual([
      { rif: 'J-1', razonSocial: 'UNO', segmentoCrudo: 'Abastos', estadoCrudo: 'ZULIA' },
      { rif: 'J-2', razonSocial: 'DOS', segmentoCrudo: 'Bodegas', estadoCrudo: 'MIRANDA' },
    ])
  })

  test('rows with no RIF (blank padding) are dropped', async () => {
    const wb = buildClientesWorkbook([cliente({ rif: 'J-1' })], SEEDS.segmentos, SEEDS.estados)
    const wsMatrix = await comoMatriz(wb)
    wsMatrix.push(['', '', '', '', '', ''], ['', '', '', '', '', ''])
    expect(parsePlantillaClientes(wsMatrix)).toHaveLength(1)
  })
})

describe('matchSegmento / matchEstado', () => {
  test('match the catalog case- and accent-insensitively', () => {
    expect(matchSegmento('bodegas', SEEDS.segmentos)?.n3).toBe('Bodegas')
    expect(matchSegmento('smi - mini market', SEEDS.segmentos)?.n3).toBe('SMI - Mini Market')
    expect(matchEstado('anzoátegui', SEEDS.estados)).toBe('ANZOATEGUI')
  })

  test('return null for an empty or unknown value rather than guessing', () => {
    expect(matchSegmento('', SEEDS.segmentos)).toBeNull()
    expect(matchSegmento('TIENDA RARA', SEEDS.segmentos)).toBeNull()
    expect(matchEstado('', SEEDS.estados)).toBeNull()
    expect(matchEstado('LA GUAIRA', SEEDS.estados)).toBeNull() // not a catalog name
  })
})

describe('importClientesTemplate (store)', () => {
  beforeEach(async () => {
    await clearLearned()
    await useStore.getState().refreshLearned()
  })

  /** Turns a workbook into the File the store's importer expects. */
  async function comoArchivo(wb: ExcelJS.Workbook): Promise<File> {
    const buffer = await wb.xlsx.writeBuffer()
    return new File([buffer], 'planilla.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  }

  // The regression this whole module exists for: before the header-row scan, importing the styled
  // template read row 1 ("HEINZ - CLASIFICACIÓN DE CLIENTES") as the header and imported nothing.
  test('imports the app\'s OWN styled template — the round trip that used to be impossible', async () => {
    const wb = buildClientesWorkbook(
      [cliente({ rif: 'J-11111111-1', razonSocial: 'UNO' })],
      SEEDS.segmentos, SEEDS.estados,
    )
    const ws = wb.getWorksheet(HOJA_CLIENTES)!
    ws.getCell('E5').value = 'Abastos'
    ws.getCell('F5').value = 'ZULIA'

    const result = await useStore.getState().importClientesTemplate(await comoArchivo(wb))
    expect(result).toEqual({ added: 1, skipped: 0 })

    const maestro = await getManualMaestro()
    expect(maestro).toHaveLength(1)
    expect(maestro[0]).toMatchObject({
      rif: 'J111111111',
      razonSocial: 'UNO',
      segmentoN3: 'Abastos',
      macroN1: 'TRADE TRADICIONAL',
      estadoHabitual: 'ZULIA',
      metodo: 'MANUAL',
    })
  })

  test('a state-only row is imported as an estado-only maestro entry', async () => {
    const wb = buildClientesWorkbook([cliente({ rif: 'J-2' })], SEEDS.segmentos, SEEDS.estados)
    wb.getWorksheet(HOJA_CLIENTES)!.getCell('F5').value = 'MIRANDA'

    expect(await useStore.getState().importClientesTemplate(await comoArchivo(wb)))
      .toEqual({ added: 1, skipped: 0 })
    const maestro = await getManualMaestro()
    expect(maestro[0]).toMatchObject({ segmentoN3: null, estadoHabitual: 'MIRANDA' })
  })

  test('a second import merges instead of erasing what the first one captured', async () => {
    const soloSegmento = buildClientesWorkbook([cliente({ rif: 'J-3' })], SEEDS.segmentos, SEEDS.estados)
    soloSegmento.getWorksheet(HOJA_CLIENTES)!.getCell('E5').value = 'Kioscos'
    await useStore.getState().importClientesTemplate(await comoArchivo(soloSegmento))

    const soloEstado = buildClientesWorkbook([cliente({ rif: 'J-3' })], SEEDS.segmentos, SEEDS.estados)
    soloEstado.getWorksheet(HOJA_CLIENTES)!.getCell('F5').value = 'LARA'
    await useStore.getState().importClientesTemplate(await comoArchivo(soloEstado))

    const maestro = await getManualMaestro()
    expect(maestro).toHaveLength(1)
    expect(maestro[0]).toMatchObject({ segmentoN3: 'Kioscos', estadoHabitual: 'LARA' })
  })

  test('a row that resolves neither field is skipped, not stored empty', async () => {
    const wb = buildClientesWorkbook([cliente({ rif: 'J-4' })], SEEDS.segmentos, SEEDS.estados)
    wb.getWorksheet(HOJA_CLIENTES)!.getCell('E5').value = 'ALGO QUE NO EXISTE'

    expect(await useStore.getState().importClientesTemplate(await comoArchivo(wb)))
      .toEqual({ added: 0, skipped: 1 })
    expect(await getManualMaestro()).toHaveLength(0)
  })

  test('a sheet with no recognizable header row is rejected with a clear message', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Hoja')
    ws.getCell('A1').value = 'nada'
    ws.getCell('A2').value = 'que ver'

    await expect(useStore.getState().importClientesTemplate(await comoArchivo(wb)))
      .rejects.toThrow(/RIF/)
  })
})

describe('exportUnclassifiedZip (store)', () => {
  const cliente2 = (over: Partial<ClientesSinClasificarRow>): ClientesSinClasificarRow =>
    cliente({ ...over })

  test('emits one styled workbook per distributor, and each one imports back cleanly', async () => {
    const original = adapters.writeToTarget
    let zipBlob: Blob | undefined
    let nombre = ''
    adapters.writeToTarget = async (_target, blob, name) => { zipBlob = blob; nombre = name; return 'saved' }

    try {
      useStore.setState({
        runId: 'run-9',
        runResult: {
          clientesSinClasificar: [
            cliente2({ distribuidor: 'DIST NORTE', rif: 'J-1', razonSocial: 'UNO' }),
            cliente2({ distribuidor: 'DIST SUR', rif: 'J-2', razonSocial: 'DOS', faltaSegmento: false, segmentoActual: 'Bodegas' }),
          ],
        } as never,
      })

      await useStore.getState().exportUnclassifiedZip()
      expect(nombre).toBe('planillas_distribuidores_run-9.zip')
      expect(zipBlob).toBeDefined()

      const zip = await JSZip.loadAsync(await zipBlob!.arrayBuffer())
      const nombres = Object.keys(zip.files).sort()
      expect(nombres).toEqual([
        'Plantilla_Clientes_DIST_NORTE.xlsx',
        'Plantilla_Clientes_DIST_SUR.xlsx',
      ])

      // Every emitted workbook must be readable by the importer — the round trip end to end.
      for (const name of nombres) {
        const buf = await zip.file(name)!.async('arraybuffer')
        const wb = XLSX.read(buf, { type: 'array' })
        expect(wb.SheetNames).toEqual([HOJA_CLIENTES, HOJA_SEGMENTOS, HOJA_ESTADOS])
        const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[HOJA_CLIENTES], { header: 1, defval: '', raw: false })
        expect(matrix[3]).toEqual([...TEMPLATE_HEADERS])
        expect(parsePlantillaClientes(matrix)).toHaveLength(1)
      }
    } finally {
      adapters.writeToTarget = original
      useStore.setState({ runResult: null, runId: null })
    }
  })
})
