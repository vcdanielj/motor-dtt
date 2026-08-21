import { useStore } from '@/state/store'
import { adapters } from '@/adapters'
import type { PipelineRunResult, ProgressEvent } from '@/contracts/pipeline'

const RESULT: PipelineRunResult = {
  summary: {
    fileName: 'real.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, clientes: 60, bytes: 10,
    schema: { rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'EDO', ciudad: null, passthrough: [], unmapped: [] },
    headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3,
  },
  segmento: { MAESTRO: 0, EXACTO: 4500, FUZZY: 0, SIN_CLASIFICAR: 500 },
  estado: { EXACTO: 0, DICCIONARIO: 0, RIF: 0, CIUDAD: 0, FUZZY: 0, SIN_ESTADO: 0 },
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
  recuperadosEstado: 0,
  clientesSinClasificar: [],
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

test('exportBase reuses the run file, calls runExport (version+runId only, no maestro) then writes, and lands on done', async () => {
  const file = new File(['a'], 'real.csv')
  await seedCompletedRun(file)
  const { runId, versionDiccionario } = useStore.getState()
  expect(runId).not.toBeNull()

  const fakeBlob = new Blob(['x'], { type: 'text/csv' })
  const orden: string[] = []
  let runExportArgs: unknown[] = []
  let pickArgs: unknown[] = []
  let writeArgs: unknown[] = []
  const originalRunExport = adapters.runExport
  const originalPick = adapters.pickSaveTarget
  const originalWrite = adapters.writeToTarget
  const fakeTarget = { kind: 'handle' as const, handle: { createWritable: async () => ({ write: async () => {}, close: async () => {} }) } }
  adapters.pickSaveTarget = async (name, types) => {
    orden.push('pick')
    pickArgs = [name, types]
    return fakeTarget
  }
  adapters.runExport = async (f, version, id, onProgress: (e: ProgressEvent) => void) => {
    orden.push('export')
    runExportArgs = [f, version, id]
    onProgress({ type: 'progress', rows: 5000, distributors: 0, clientes: 0, bytesRead: 0 })
    return { blob: fakeBlob, rows: 5000 }
  }
  adapters.writeToTarget = async (target, blob, name) => {
    orden.push('write')
    writeArgs = [target, blob, name]
    return 'saved'
  }

  try {
    await useStore.getState().exportBase()

    expect(useStore.getState().exportState).toBe('done')
    expect(useStore.getState().exportRows).toBe(5000)
    // THE regression guard: the destination is picked BEFORE the (minutes-long) export. Asking
    // afterwards outlives the browser's user-activation window and Chrome refuses the picker with
    // "Must be handling a user gesture to show a file picker", losing the finished export.
    expect(orden).toEqual(['pick', 'export', 'write'])
    // Only 3 args: file, version, runId — the capped runResult.maestro is NOT passed (the worker
    // builds the full maestro itself), so recovery can never be limited to the 500-row view array.
    expect(runExportArgs).toHaveLength(3)
    expect(runExportArgs[0]).toBe(file)
    expect(runExportArgs[1]).toBe(versionDiccionario)
    expect(runExportArgs[2]).toBe(runId)
    expect(pickArgs[0]).toBe(`base_estandarizada_${runId}.xlsx`)
    expect(writeArgs[0]).toBe(fakeTarget)
    expect(writeArgs[1]).toBe(fakeBlob)
    expect(writeArgs[2]).toBe(`base_estandarizada_${runId}.xlsx`)
  } finally {
    adapters.runExport = originalRunExport
    adapters.pickSaveTarget = originalPick
    adapters.writeToTarget = originalWrite
  }
})

test('cancelling the save picker skips the export entirely — no minutes wasted on a declined file', async () => {
  const file = new File(['a'], 'real-cancel.csv')
  await seedCompletedRun(file)

  let exportRan = false
  const originalRunExport = adapters.runExport
  const originalPick = adapters.pickSaveTarget
  adapters.pickSaveTarget = async () => ({ kind: 'cancelled' as const })
  adapters.runExport = async () => {
    exportRan = true
    return { blob: new Blob(['x']), rows: 1 }
  }

  try {
    await useStore.getState().exportBase()
    expect(exportRan).toBe(false)
    expect(useStore.getState().exportState).toBe('idle')
  } finally {
    adapters.runExport = originalRunExport
    adapters.pickSaveTarget = originalPick
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
  const originalWrite = adapters.writeToTarget
  adapters.runExport = async () => ({ blob: new Blob(['x']), rows: 10 })
  adapters.writeToTarget = async () => 'cancelled' as const

  try {
    await useStore.getState().exportBase()
    expect(useStore.getState().exportState).toBe('idle')
  } finally {
    adapters.runExport = originalRunExport
    adapters.writeToTarget = originalWrite
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
