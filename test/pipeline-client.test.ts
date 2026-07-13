import { runPipeline } from '@/worker/client'
import type { PipelineRunResult } from '@/contracts/pipeline'

const RESULT: PipelineRunResult = {
  summary: {
    fileName: 'x.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10,
    schema: { rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'EDO', ciudad: null, passthrough: [], unmapped: [] },
    headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3,
  },
  segmento: { MAESTRO: 0, EXACTO: 4000, FUZZY: 500, SIN_CLASIFICAR: 500 },
  clasificacionPct: 90,
  clasificacionCrudoPct: 92.4,
  estadoValidoPct: 98.1,
  tonTotal: 1000,
  tonSinClasificar: 50,
  distribuidores: [{ id: 'd0', nombre: 'EXCELSIOR RK', scdcCrudo: 31, scdcPost: 74, registros: 100, ton: 10 }],
  cola: [],
}

class FakePipelineWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'x.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'progress', rows: 5000, distributors: 12, bytesRead: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'result', result: RESULT } } as MessageEvent)
    })
  }
  terminate() {}
}

class FakePipelineErrorWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'x.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' } } as MessageEvent)
    })
  }
  terminate() {}
}

test('runPipeline streams progress then resolves with the full result', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakePipelineWorker
  const events: string[] = []
  const result = await runPipeline(new File(['a'], 'x.csv'), (e) => events.push(e.type))
  expect(events).toEqual(['start', 'progress', 'result'])
  expect(result.summary.totalRows).toBe(5000)
  expect(result.distribuidores).toHaveLength(1)
  expect(result.clasificacionCrudoPct).toBe(92.4)
})

test('runPipeline rejects when the worker emits an error event', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakePipelineErrorWorker
  await expect(runPipeline(new File(['a'], 'x.csv'), () => {})).rejects.toThrow(/EMPTY/)
})
