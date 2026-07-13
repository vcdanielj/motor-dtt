import { useStore } from '@/state/store'
import { adapters } from '@/adapters'
import type { PipelineRunResult, ProgressEvent } from '@/contracts/pipeline'

const RESULT: PipelineRunResult = {
  summary: {
    fileName: 'real.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10,
    schema: { rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'EDO', ciudad: null, passthrough: [], unmapped: [] },
    headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3,
  },
  segmento: { MAESTRO: 0, EXACTO: 4500, FUZZY: 0, SIN_CLASIFICAR: 500 },
  clasificacionPct: 90,
  clasificacionCrudoPct: 92.4,
  estadoValidoPct: 98.1,
  tonTotal: 100,
  tonSinClasificar: 5,
  distribuidores: [],
  cola: [],
  maestro: [
    {
      rif: 'J-1', razonSocial: 'CLIENTE UNO', segmentoN3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)',
      metodo: 'MAESTRO', confianza: 'N3', estadoHabitual: null, fechaClasificacion: null, reglaCanonica: 'RECIENTE',
    },
  ],
  maestroTotal: 1,
  conflictos: 0,
  recuperadosMaestro: 0,
}

class FakeResultWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'result', result: RESULT } } as MessageEvent)
    })
  }
  terminate() {}
}

// Establishes a completed run in the store (lastFile + runResult + runId), the precondition
// exportBase relies on — mirrors what DropZone -> startPipeline does in the real app.
async function seedCompletedRun(file: File) {
  // @ts-expect-error test double
  globalThis.Worker = FakeResultWorker
  await useStore.getState().startPipeline(file)
}

test('exportBase reuses the run file + maestro, calls runExport then saveBlob, and lands on done', async () => {
  const file = new File(['a'], 'real.csv')
  await seedCompletedRun(file)
  const { runId, versionDiccionario } = useStore.getState()
  expect(runId).not.toBeNull()

  const fakeBlob = new Blob(['x'], { type: 'text/csv' })
  let runExportArgs: unknown[] = []
  let saveArgs: unknown[] = []
  const originalRunExport = adapters.runExport
  const originalSaveBlob = adapters.saveBlob
  adapters.runExport = async (f, maestro, version, id, onProgress: (e: ProgressEvent) => void) => {
    runExportArgs = [f, maestro, version, id]
    onProgress({ type: 'progress', rows: 5000, distributors: 0, bytesRead: 0 })
    return { blob: fakeBlob, rows: 5000 }
  }
  adapters.saveBlob = async (blob, name) => {
    saveArgs = [blob, name]
    return 'saved'
  }

  try {
    await useStore.getState().exportBase()

    expect(useStore.getState().exportState).toBe('done')
    expect(useStore.getState().exportRows).toBe(5000)
    expect(runExportArgs[0]).toBe(file)
    expect(runExportArgs[1]).toEqual(RESULT.maestro)
    expect(runExportArgs[2]).toBe(versionDiccionario)
    expect(runExportArgs[3]).toBe(runId)
    expect(saveArgs[0]).toBe(fakeBlob)
    expect(saveArgs[1]).toBe(`base_estandarizada_${runId}.csv`)
  } finally {
    adapters.runExport = originalRunExport
    adapters.saveBlob = originalSaveBlob
  }
})

test('exportBase is a no-op when there is no completed run yet', async () => {
  useStore.setState({ lastFile: null, runResult: null, runId: null, exportState: 'idle' })
  await useStore.getState().exportBase()
  expect(useStore.getState().exportState).toBe('idle')
})

test('a cancelled File System Access save returns exportState to idle quietly (not error)', async () => {
  const file = new File(['a'], 'real2.csv')
  await seedCompletedRun(file)

  const originalRunExport = adapters.runExport
  const originalSaveBlob = adapters.saveBlob
  adapters.runExport = async () => ({ blob: new Blob(['x']), rows: 10 })
  adapters.saveBlob = async () => 'cancelled'

  try {
    await useStore.getState().exportBase()
    expect(useStore.getState().exportState).toBe('idle')
  } finally {
    adapters.runExport = originalRunExport
    adapters.saveBlob = originalSaveBlob
  }
})

test('a runExport failure marks exportState as error', async () => {
  const file = new File(['a'], 'real3.csv')
  await seedCompletedRun(file)

  const originalRunExport = adapters.runExport
  adapters.runExport = async () => {
    throw new Error('PARSE_ERROR: boom')
  }

  try {
    await useStore.getState().exportBase()
    expect(useStore.getState().exportState).toBe('error')
    expect(useStore.getState().exportError).toMatch(/boom/)
  } finally {
    adapters.runExport = originalRunExport
  }
})
