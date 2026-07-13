import { create } from 'zustand'
import { adapters } from '@/adapters'
import { getLearnedDiccionario, getManualMaestro } from '@/storage/db'
import { loadRunConfig } from '@/storage/run-config'
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

// State of the on-demand base-standardized CSV export (Sprint 2 · X1).
export type ExportPhase = 'idle' | 'running' | 'done' | 'error'

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
  lastFile: File | null           // the run's source file, kept so export can re-stream it
  runId: string | null            // minted when the pipeline run completes; stamped into the export
  versionDiccionario: string      // stamped into the export's version_diccionario column
  exportState: ExportPhase
  exportRows: number
  exportError: string | null
  // Counts of what the analyst has taught the motor so far, persisted in IndexedDB (Sprint 2 ·
  // C1) — populated on init and after any write, shown read-only in Config.
  learned: { diccionario: number; maestro: number }
  startIngest: (file: File) => Promise<void>
  startPipeline: (file: File) => Promise<void>
  exportBase: () => Promise<void>
  refreshLearned: () => Promise<void>
}

// Sprint 2: no config UI yet for the diccionario version — a fixed tag, same spirit as the
// hardcoded 92/80 fuzzy thresholds elsewhere (src/worker/ingest.worker.ts, Config.tsx).
const VERSION_DICCIONARIO = 'v1'

export const useStore = create<StoreState>((set, get) => ({
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
  lastFile: null,
  runId: null,
  versionDiccionario: VERSION_DICCIONARIO,
  exportState: 'idle',
  exportRows: 0,
  exportError: null,
  learned: { diccionario: 0, maestro: 0 },
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
    set({
      ingest: { phase: 'running', rows: 0, distributors: 0, fileName: file.name, summary: null, error: null },
      lastFile: file,
      runId: null,
      exportState: 'idle',
      exportRows: 0,
      exportError: null,
    })
    const startedAt = Date.now()
    try {
      // Merge learned diccionario/manual maestro (IndexedDB) over the embedded seeds so this run
      // benefits from everything the analyst has taught the motor so far (Sprint 2 · C1).
      const runConfig = await loadRunConfig()
      const result = await adapters.runPipeline(file, (e: ProgressEvent) => {
        if (e.type === 'progress') set((s) => ({ ingest: { ...s.ingest, rows: e.rows, distributors: e.distributors } }))
      }, runConfig)
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
        // Minted here (not in the worker, which never touches Date.now()) so the export pass
        // can stamp a stable run_id — reusing the timestamp already computed for this run.
        runId: `run-${startedAt}`,
      }))
    } catch (err) {
      set((s) => ({ ingest: { ...s.ingest, phase: 'error', error: (err as Error).message } }))
    }
  },
  // On-demand export (Sprint 2 · X1): re-streams the run's file through the worker's
  // export mode, which builds the FULL maestro itself (two-pass, uncapped), then saves the
  // resulting CSV Blob. No-ops quietly if there's no completed run yet to reuse.
  exportBase: async () => {
    const { lastFile, runResult, runId, versionDiccionario } = get()
    if (!lastFile || !runResult || !runId) return
    set({ exportState: 'running', exportRows: 0, exportError: null })
    try {
      // Same learned merge as startPipeline, so the export reflects everything taught so far.
      const runConfig = await loadRunConfig()
      // The worker builds the full maestro itself (two-pass) — we pass only version + runId,
      // never the 500-capped runResult.maestro view array (would cap recovery at 500 RIFs).
      const { blob, rows } = await adapters.runExport(
        lastFile,
        versionDiccionario,
        runId,
        (e: ProgressEvent) => {
          if (e.type === 'progress') set({ exportRows: e.rows })
        },
        runConfig,
      )
      const outcome = await adapters.saveBlob(blob, `base_estandarizada_${runId}.csv`)
      // A user-cancelled save picker is not an error — return to idle quietly (brief §5).
      set({ exportState: outcome === 'cancelled' ? 'idle' : 'done', exportRows: rows })
    } catch (err) {
      set({ exportState: 'error', exportError: (err as Error).message })
    }
  },
  // Reads persisted counts from IndexedDB (best-effort — [] when unavailable) so Config can show
  // what's been learned so far. Called on app init and safe to re-call after any storage write.
  refreshLearned: async () => {
    const [diccionario, maestro] = await Promise.all([getLearnedDiccionario(), getManualMaestro()])
    set({ learned: { diccionario: diccionario.length, maestro: maestro.length } })
  },
}))

// Populate persisted-learning counts as soon as the store exists (IndexedDB reads are async and
// best-effort — a no-op fallback to {0,0} when unavailable, e.g. under jsdom in tests).
void useStore.getState().refreshLearned()
