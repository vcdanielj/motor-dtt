import type { ProgressEvent, IngestSummary, PipelineRunResult } from '@/contracts/pipeline'

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

export function runPipeline(file: File, onProgress: (e: ProgressEvent) => void): Promise<PipelineRunResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ingest.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<ProgressEvent>) => {
      const e = ev.data
      onProgress(e)
      if (e.type === 'result') { worker.terminate(); resolve(e.result) }
      else if (e.type === 'error') { worker.terminate(); reject(new Error(`${e.code}: ${e.message}`)) }
    }
    worker.onerror = (err) => { worker.terminate(); reject(err instanceof ErrorEvent ? err.error : new Error('worker error')) }
    worker.postMessage({ file, mode: 'pipeline' })
  })
}

// On-demand export pass: re-streams `file` through the worker's `mode:'export'` branch, which
// builds the FULL maestro internally (two passes) and applies it, resolving with the finished CSV
// Blob + row count. Keeps runIngest/runPipeline untouched — this is a new, additive worker mode.
export function runExport(
  file: File,
  versionDiccionario: string,
  runId: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<{ blob: Blob; rows: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ingest.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<ProgressEvent>) => {
      const e = ev.data
      onProgress(e)
      if (e.type === 'export') { worker.terminate(); resolve({ blob: e.blob, rows: e.rows }) }
      else if (e.type === 'error') { worker.terminate(); reject(new Error(`${e.code}: ${e.message}`)) }
    }
    worker.onerror = (err) => { worker.terminate(); reject(err instanceof ErrorEvent ? err.error : new Error('worker error')) }
    worker.postMessage({ file, mode: 'export', versionDiccionario, runId })
  })
}
