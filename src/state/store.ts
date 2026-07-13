import { create } from 'zustand'
import { adapters } from '@/adapters'
import type { ProgressEvent, IngestSummary, PipelineRunResult } from '@/contracts/pipeline'

export type ViewKey = 'dashboard' | 'corrida' | 'distribuidores' | 'cola' | 'maestro' | 'config' | 'manual'

interface IngestState {
  phase: 'idle' | 'running' | 'done' | 'error'
  rows: number
  distributors: number
  fileName: string | null
  summary: IngestSummary | null
  error: string | null
}

// Renders a fraction-of-100 as an es-VE percentage string ("92,4%") — comma decimal,
// matching the mock dashboard's formatting (src/mocks/dashboard.ts).
function pctEs(n: number): string {
  return `${n}`.replace('.', ',') + '%'
}

interface StoreState {
  view: ViewKey
  setView: (v: ViewKey) => void
  seeds: typeof adapters.seeds
  dashboard: ReturnType<typeof adapters.getDashboard>
  distribuidores: ReturnType<typeof adapters.getDistribuidores>
  cola: ReturnType<typeof adapters.getCola>
  maestro: ReturnType<typeof adapters.getMaestro>
  stages: ReturnType<typeof adapters.getStages>
  ingest: IngestState
  runResult: PipelineRunResult | null
  startIngest: (file: File) => Promise<void>
  startPipeline: (file: File) => Promise<void>
}

export const useStore = create<StoreState>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),
  seeds: adapters.seeds,
  dashboard: adapters.getDashboard(),
  distribuidores: adapters.getDistribuidores(),
  cola: adapters.getCola(),
  maestro: adapters.getMaestro(),
  stages: adapters.getStages(),
  ingest: { phase: 'idle', rows: 0, distributors: 0, fileName: null, summary: null, error: null },
  runResult: null,
  startIngest: async (file) => {
    set({ ingest: { phase: 'running', rows: 0, distributors: 0, fileName: file.name, summary: null, error: null } })
    const startedAt = Date.now()
    try {
      const rawSummary = await adapters.ingest(file, (e: ProgressEvent) => {
        if (e.type === 'progress') set((s) => ({ ingest: { ...s.ingest, rows: e.rows, distributors: e.distributors } }))
      })
      const summary = { ...rawSummary, startedAt, finishedAt: Date.now() }
      set((s) => ({ ingest: { ...s.ingest, phase: 'done', rows: summary.totalRows, distributors: summary.distributors, summary } }))
    } catch (err) {
      set((s) => ({ ingest: { ...s.ingest, phase: 'error', error: (err as Error).message } }))
    }
  },
  startPipeline: async (file) => {
    set({ ingest: { phase: 'running', rows: 0, distributors: 0, fileName: file.name, summary: null, error: null } })
    const startedAt = Date.now()
    try {
      const result = await adapters.runPipeline(file, (e: ProgressEvent) => {
        if (e.type === 'progress') set((s) => ({ ingest: { ...s.ingest, rows: e.rows, distributors: e.distributors } }))
      })
      const summary = { ...result.summary, startedAt, finishedAt: Date.now() }
      set(() => ({
        ingest: { phase: 'done', rows: summary.totalRows, distributors: summary.distributors, fileName: file.name, summary, error: null },
        distribuidores: result.distribuidores,
        cola: result.cola,
        maestro: result.maestro,
        dashboard: {
          totalFilas: summary.totalRows.toLocaleString('es-VE'),
          estadoValido: pctEs(result.estadoValidoPct),
          coberturaN3: pctEs(result.clasificacionCrudoPct),
          clasificacionN3: pctEs(result.clasificacionPct),
        },
        runResult: { ...result, summary },
      }))
    } catch (err) {
      set((s) => ({ ingest: { ...s.ingest, phase: 'error', error: (err as Error).message } }))
    }
  },
}))
