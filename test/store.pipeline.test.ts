import { useStore } from '@/state/store'
import type { PipelineRunResult } from '@/contracts/pipeline'

const RESULT: PipelineRunResult = {
  summary: {
    fileName: 'real.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10,
    schema: { rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'EDO', ciudad: null, passthrough: [], unmapped: [] },
    headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3,
  },
  segmento: { MAESTRO: 0, EXACTO: 4000, FUZZY: 500, SIN_CLASIFICAR: 500 },
  estado: { EXACTO: 0, DICCIONARIO: 0, RIF: 0, CIUDAD: 0, FUZZY: 0, SIN_ESTADO: 0 },
  clasificacionPct: 90,
  clasificacionCrudoPct: 92.4,
  estadoValidoPct: 98.1,
  tonTotal: 1000,
  tonSinClasificar: 50,
  distribuidores: [{ id: 'd0', nombre: 'REAL DISTRIBUIDOR', scdcCrudo: 31, scdcPost: 74, registros: 100, ton: 10 }],
  cola: [
    {
      id: 'variante_nueva-x',
      dominio: 'SEGMENTO',
      tipo: 'VARIANTE_NUEVA',
      valorCrudo: 'X',
      registrosAfectados: 5,
      tonAfectadas: 1.2,
      sugerenciaFuzzy: { valor: 'ABASTOS', score: 85 },
      resolucion: null,
    },
  ],
  maestro: [
    {
      rif: 'J-1',
      razonSocial: 'CLIENTE UNO',
      segmentoN3: 'BODEGA',
      macroN1: 'TRADE TRADICIONAL (UTT)',
      metodo: 'MAESTRO',
      confianza: 'N3',
      estadoHabitual: null,
      fechaClasificacion: null,
      reglaCanonica: 'RECIENTE',
    },
  ],
  maestroTotal: 1,
  conflictos: 0,
  recuperadosMaestro: 12,
  recuperadosEstado: 0,
  clientesSinClasificar: [],
}

class FakeResultWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'real.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'progress', rows: 5000, distributors: 12, bytesRead: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'result', result: RESULT } } as MessageEvent)
    })
  }
  terminate() {}
}

class FakeErrorWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' } } as MessageEvent)
    })
  }
  terminate() {}
}

test('startPipeline repopulates dashboard/distribuidores/cola with real results', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeResultWorker
  await useStore.getState().startPipeline(new File(['a'], 'real.csv'))

  const s = useStore.getState()
  expect(s.ingest.phase).toBe('done')
  expect(s.ingest.rows).toBe(5000)
  expect(s.distribuidores).toEqual(RESULT.distribuidores)
  expect(s.cola).toEqual(RESULT.cola)
  expect(s.maestro).toEqual(RESULT.maestro)
  expect(s.dashboard).toEqual({
    totalFilas: '5.000',
    estadoValido: '98,1%',
    coberturaN3: '92,4%',
    clasificacionN3: '90%',
  })
  expect(s.runResult?.distribuidores).toEqual(RESULT.distribuidores)
  expect(s.runResult?.maestroTotal).toBe(1)
  expect(s.runResult?.recuperadosMaestro).toBe(12)
})

test('startPipeline sets ingest to error when the worker emits an error event', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeErrorWorker
  await useStore.getState().startPipeline(new File(['a'], 'bad.csv'))
  expect(useStore.getState().ingest.phase).toBe('error')
  expect(useStore.getState().ingest.error).toMatch(/EMPTY/)
})
