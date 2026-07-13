import { create } from 'zustand'
import { adapters } from '@/adapters'
import type { ProgressEvent, IngestSummary } from '@/contracts/pipeline'

export type ViewKey = 'dashboard' | 'corrida' | 'distribuidores' | 'cola' | 'maestro' | 'config'

interface IngestState {
  phase: 'idle' | 'running' | 'done' | 'error'
  rows: number
  distributors: number
  fileName: string | null
  summary: IngestSummary | null
  error: string | null
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
  startIngest: (file: File) => Promise<void>
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
  startIngest: async (file) => {
    set({ ingest: { phase: 'running', rows: 0, distributors: 0, fileName: file.name, summary: null, error: null } })
    try {
      const summary = await adapters.ingest(file, (e: ProgressEvent) => {
        if (e.type === 'progress') set((s) => ({ ingest: { ...s.ingest, rows: e.rows, distributors: e.distributors } }))
      })
      set((s) => ({ ingest: { ...s.ingest, phase: 'done', rows: summary.totalRows, distributors: summary.distributors, summary } }))
    } catch (err) {
      set((s) => ({ ingest: { ...s.ingest, phase: 'error', error: (err as Error).message } }))
    }
  },
}))
