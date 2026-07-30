import { runExport } from '@/worker/client'

class FakeExportWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'x.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'progress', rows: 100, distributors: 0, clientes: 0, bytesRead: 10 } } as MessageEvent)
      this.onmessage?.({
        data: { type: 'export', blob: new Blob(['RIF,CANAL\n1,ABASTOS\n'], { type: 'text/csv;charset=utf-8;' }), rows: 100 },
      } as MessageEvent)
    })
  }
  terminate() {}
}

class FakeExportErrorWorker {
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

test('runExport streams start→progress→export and resolves with the CSV blob + row count', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeExportWorker
  const events: string[] = []
  const { blob, rows } = await runExport(new File(['a'], 'x.csv'), 'v1', 'run-1', (e) => events.push(e.type))
  expect(events).toEqual(['start', 'progress', 'export'])
  expect(rows).toBe(100)
  expect(blob.type).toContain('text/csv')
})

test('runExport posts an export message with no maestro argument (worker builds it internally)', async () => {
  let posted: unknown
  class SpyWorker {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    postMessage(msg: unknown) {
      posted = msg
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'export', blob: new Blob(['x']), rows: 1 } } as MessageEvent)
      })
    }
    terminate() {}
  }
  // @ts-expect-error test double
  globalThis.Worker = SpyWorker
  await runExport(new File(['a'], 'x.csv'), 'v9', 'run-9', () => {})
  expect(posted).toMatchObject({ mode: 'export', versionDiccionario: 'v9', runId: 'run-9' })
  expect(posted).not.toHaveProperty('maestro')
})

test('runExport rejects when the worker emits an error event', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeExportErrorWorker
  await expect(runExport(new File(['a'], 'x.csv'), 'v1', 'run-1', () => {})).rejects.toThrow(/EMPTY/)
})
