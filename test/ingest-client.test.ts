import { runIngest } from '@/worker/client'
import type { IngestSummary } from '@/contracts/pipeline'

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'x.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'progress', rows: 5000, distributors: 12, bytesRead: 10 } } as MessageEvent)
      const summary: IngestSummary = { fileName: 'x.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10, schema: { rif: 'RIF', segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] }, headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3 }
      this.onmessage?.({ data: { type: 'done', summary } } as MessageEvent)
    })
  }
  terminate() {}
}

class FakeErrorWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'x.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'error', code: 'BAD_SCHEMA', message: 'Encabezados no reconocidos: falta RIF, segmento y estado' } } as MessageEvent)
    })
  }
  terminate() {}
}

test('runIngest streams progress then resolves with summary', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeWorker
  const events: string[] = []
  const summary = await runIngest(new File(['a'], 'x.csv'), (e) => events.push(e.type))
  expect(events).toEqual(['start', 'progress', 'done'])
  expect(summary.totalRows).toBe(5000)
  expect(summary.distributors).toBe(12)
})

test('runIngest rejects when the worker emits an error event', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeErrorWorker
  await expect(runIngest(new File(['a'], 'x.csv'), () => {})).rejects.toThrow(/BAD_SCHEMA/)
})
