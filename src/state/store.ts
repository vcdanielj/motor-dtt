import { create } from 'zustand'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { adapters } from '@/adapters'
import { normalizeText, normalizeRif } from '@/ingest/normalize'
import {
  getLearnedDiccionario, getManualMaestro, putLearnedDiccionario, putManualMaestro,
  getMeta, putMeta, clearLearned,
} from '@/storage/db'
import { loadRunConfig } from '@/storage/run-config'
import { csvDocument } from '@/reports/csv'
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

// Editable fuzzy thresholds (Sprint 2 · C3) — persisted in IndexedDB meta, applied by the
// pipeline/export worker calls, defaults match the long-standing hardcoded 92/80.
export interface Thresholds { fuzzyThreshold: number; fuzzySuggestFloor: number }

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
  // Editable fuzzy thresholds (Sprint 2 · C3): loaded from meta on init, applied to every
  // subsequent pipeline/export run via the worker message.
  thresholds: Thresholds
  // Per-stage status map: key = stageIndex (0-5), value = { status, detail }.
  // Populated by stage events from the pipeline worker; reset when a new run starts.
  stageStatuses: Record<number, { status: 'running' | 'done'; detail: string }>
  startIngest: (file: File) => Promise<void>
  startPipeline: (file: File) => Promise<void>
  exportBase: () => Promise<void>
  refreshLearned: () => Promise<void>
  resolveColaItem: (id: string, segmentoN3: string) => Promise<void>
  exportLearnedDiccionario: () => Promise<void>
  exportManualMaestro: () => Promise<void>
  importDiccionarioCsv: (file: File) => Promise<{ added: number; skipped: number }>
  exportUnclassifiedTemplate: () => Promise<void>
  importClientesTemplate: (file: File) => Promise<{ added: number; skipped: number }>
  saveThresholds: (fuzzyThreshold: number, fuzzySuggestFloor: number) => Promise<void>
  resetLearned: () => Promise<void>
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
  thresholds: { fuzzyThreshold: 92, fuzzySuggestFloor: 80 },
  stageStatuses: {},
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
      stageStatuses: {},   // reset stage progress for new run
    })
    const startedAt = Date.now()
    try {
      // Merge learned diccionario/manual maestro (IndexedDB) over the embedded seeds so this run
      // benefits from everything the analyst has taught the motor so far (Sprint 2 · C1).
      const runConfig = await loadRunConfig()
      const result = await adapters.runPipeline(file, (e: ProgressEvent) => {
        if (e.type === 'progress') set((s) => ({ ingest: { ...s.ingest, rows: e.rows, distributors: e.distributors } }))
        if (e.type === 'stage') {
          set((s) => ({
            stageStatuses: {
              ...s.stageStatuses,
              [e.stageIndex]: { status: e.status, detail: e.detail ?? '' },
            },
          }))
        }
      }, runConfig, get().thresholds)
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
        get().thresholds,
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
  // The analyst classifies a pending cola item (Sprint 2 · C2): CONFLICTO_MAYOR items carry a RIF
  // in valorCrudo and get a manual maestro override; the other tipos carry a raw segment string
  // and get a learned diccionario entry. Both feed the NEXT corrida via loadRunConfig. Never
  // throws to the UI — a storage hiccup is swallowed (putters already no-op without IndexedDB).
  resolveColaItem: async (id, segmentoN3) => {
    const { cola, seeds } = get()
    const item = cola.find((c) => c.id === id)
    if (!item) return
    const segmento = seeds.segmentos.find((s) => s.n3 === segmentoN3)
    if (!segmento) return // shouldn't happen — options come from the catalog

    try {
      if (item.tipo === 'CONFLICTO_MAYOR') {
        await putManualMaestro({
          rif: item.valorCrudo,
          razonSocial: null,
          segmentoN3,
          macroN1: segmento.macroN1,
          metodo: 'MANUAL',
          confianza: 'N3',
          estadoHabitual: null,
          fechaClasificacion: null,
          reglaCanonica: 'MANUAL',
        })
      } else {
        await putLearnedDiccionario({
          variante: item.valorCrudo,
          segmentoN3,
          macroN1: segmento.macroN1,
          codigo: segmento.codigo,
          metodo: 'EXACTO',
          activa: true,
        })
      }
      await get().refreshLearned()
    } catch {
      // storage hiccup — keep the UI usable, resolution below still reflects the analyst's intent
    }

    set((s) => ({
      cola: s.cola.map((c) => (c.id === id ? { ...c, resolucion: segmentoN3 } : c)),
    }))
  },
  // Downloads everything the analyst has taught the diccionario so far as a CSV — a local
  // snapshot the analyst can back up or hand off (Sprint 2 · C3). No sync, no server.
  exportLearnedDiccionario: async () => {
    const learned = await getLearnedDiccionario()
    const doc = csvDocument([
      ['variante', 'segmento_n3', 'macro_canal_n1', 'codigo'],
      ...learned.map((e) => [e.variante, e.segmentoN3, e.macroN1, e.codigo]),
    ])
    const blob = new Blob([doc], { type: 'text/csv;charset=utf-8;' })
    await adapters.saveBlob(blob, 'diccionario_aprendido.csv')
  },
  exportManualMaestro: async () => {
    const maestro = await getManualMaestro()
    const doc = csvDocument([
      ['rif', 'segmento_n3', 'macro_canal_n1', 'regla'],
      ...maestro.map((e) => [e.rif, e.segmentoN3 ?? '', e.macroN1 ?? '', e.reglaCanonica ?? '']),
    ])
    const blob = new Blob([doc], { type: 'text/csv;charset=utf-8;' })
    await adapters.saveBlob(blob, 'maestro_manual.csv')
  },
  // Imports a diccionario CSV the analyst picked from disk (PapaParse on the MAIN thread — small
  // file, no worker needed). Accepts `variante` + `segmento_n3`/`segmentoN3` headers, matched
  // case-insensitively; each row's segment must resolve exactly against the seed catalog (never
  // trusts an arbitrary macro/codigo pair from the file) — unknown segments or empty rows are
  // skipped, not silently misfiled. Never throws to the UI: a malformed file just yields
  // { added: 0, skipped: N }.
  importDiccionarioCsv: async (file) => {
    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    const fields = parsed.meta.fields ?? []
    const normHeader = (h: string) => h.trim().toLowerCase()
    const varianteKey = fields.find((f) => normHeader(f) === 'variante')
    const segmentoKey = fields.find((f) => normHeader(f) === 'segmento_n3' || normHeader(f) === 'segmenton3')

    let added = 0
    let skipped = 0
    if (varianteKey && segmentoKey) {
      const segmentos = get().seeds.segmentos
      for (const row of parsed.data) {
        const variante = (row[varianteKey] ?? '').trim()
        const segmentoN3 = (row[segmentoKey] ?? '').trim()
        const segmento = segmentos.find((s) => s.n3 === segmentoN3)
        if (!variante || !segmento) { skipped++; continue }
        await putLearnedDiccionario({
          variante, segmentoN3: segmento.n3, macroN1: segmento.macroN1, codigo: segmento.codigo,
          metodo: 'EXACTO', activa: true,
        })
        added++
      }
    } else {
      skipped = parsed.data.length
    }

    await get().refreshLearned()
    return { added, skipped }
  },
  exportUnclassifiedTemplate: async () => {
    const { runResult, runId } = get()
    if (!runResult || !runId || !runResult.clientesSinClasificar.length) return
    set({ exportState: 'running' })
    try {
      const headers = ['Distribuidor', 'RIF', 'Razón Social', 'Tipo de Tienda']
      const rows = runResult.clientesSinClasificar.map((c) => [
        c.distribuidor,
        c.rif,
        c.razonSocial,
        '',
      ])
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes sin Clasificar')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      const outcome = await adapters.saveBlob(
        blob,
        `planilla_clientes_sin_clasificar_${runId}.xlsx`,
        [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
      )
      set({ exportState: outcome === 'cancelled' ? 'idle' : 'done' })
    } catch (err) {
      set({ exportState: 'error', exportError: (err as Error).message })
    }
  },
  importClientesTemplate: async (file) => {
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

    if (!json.length) return { added: 0, skipped: 0 }

    const fields = Object.keys(json[0])
    const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const rifKey = fields.find((f) => ['rif', 'numeroderif'].includes(norm(f)))
    const tipoTiendaKey = fields.find((f) => ['tipodetienda', 'segmentodetienda', 'tipo', 'segmento'].includes(norm(f)))
    const razonSocialKey = fields.find((f) => ['razonsocial', 'nombre', 'nombrecliente', 'cliente'].includes(norm(f)))

    if (!rifKey || !tipoTiendaKey) {
      throw new Error('Archivo no válido: debe contener las columnas "RIF" y "Tipo de Tienda"')
    }

    let added = 0
    let skipped = 0
    const segmentos = get().seeds.segmentos

    for (const row of json) {
      const rif = (row[rifKey] ?? '').trim()
      const rawTipo = (row[tipoTiendaKey] ?? '').trim()
      const razonSocial = razonSocialKey ? (row[razonSocialKey] ?? '').trim() : null

      if (!rif || !rawTipo) {
        skipped++
        continue
      }

      const normTipo = normalizeText(rawTipo)
      const segMatch = segmentos.find((s) => normalizeText(s.n3) === normTipo)
      if (!segMatch) {
        skipped++
        continue
      }

      await putManualMaestro({
        rif: normalizeRif(rif),
        razonSocial: razonSocial || null,
        segmentoN3: segMatch.n3,
        macroN1: segMatch.macroN1,
        metodo: 'MANUAL',
        confianza: 'N3',
        estadoHabitual: null,
        fechaClasificacion: new Date().toISOString(),
        reglaCanonica: 'MANUAL',
      })
      added++
    }

    await get().refreshLearned()
    return { added, skipped }
  },
  // Persists the fuzzy thresholds to meta and updates the store, clamped to a sane range so a
  // typo can't wedge the pipeline: floor in [50,99], threshold in [floor,100] (floor ≤ threshold).
  saveThresholds: async (fuzzyThreshold, fuzzySuggestFloor) => {
    const fuzzySuggestFloorClamped = Math.min(99, Math.max(50, Math.round(fuzzySuggestFloor)))
    const fuzzyThresholdClamped = Math.min(100, Math.max(fuzzySuggestFloorClamped, Math.round(fuzzyThreshold)))
    await Promise.all([
      putMeta('fuzzyThreshold', fuzzyThresholdClamped),
      putMeta('fuzzySuggestFloor', fuzzySuggestFloorClamped),
    ])
    set({ thresholds: { fuzzyThreshold: fuzzyThresholdClamped, fuzzySuggestFloor: fuzzySuggestFloorClamped } })
  },
  // Wipes everything the analyst has taught the motor (learned diccionario + manual maestro) —
  // an explicit, deliberate reset the Config UI gates behind a two-click inline confirm.
  resetLearned: async () => {
    await clearLearned()
    await get().refreshLearned()
  },
}))

// Populate persisted-learning counts as soon as the store exists (IndexedDB reads are async and
// best-effort — a no-op fallback to {0,0} when unavailable, e.g. under jsdom in tests).
void useStore.getState().refreshLearned()

// Load persisted fuzzy thresholds (Sprint 2 · C3) as soon as the store exists — falls back to the
// long-standing 92/80 defaults when meta is empty or IndexedDB is unavailable.
void (async () => {
  const [fuzzyThreshold, fuzzySuggestFloor] = await Promise.all([
    getMeta('fuzzyThreshold', 92),
    getMeta('fuzzySuggestFloor', 80),
  ])
  useStore.setState({ thresholds: { fuzzyThreshold, fuzzySuggestFloor } })
})()
