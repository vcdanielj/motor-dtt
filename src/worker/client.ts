import type { ProgressEvent, IngestSummary } from '@/contracts/pipeline'

export function runIngest(file: File, onProgress: (e: ProgressEvent) => void): Promise<IngestSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ingest.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<ProgressEvent>) => {
      const e = ev.data
      onProgress(e)
      if (e.type === 'done') { worker.terminate(); resolve(e.summary) }
      else if (e.type === 'error') { worker.terminate(); reject(new Error(`${e.code}: ${e.message}`)) }
    }
    worker.onerror = (err) => { worker.terminate(); reject(err instanceof ErrorEvent ? err.error : new Error('worker error')) }
    worker.postMessage({ file })
  })
}
