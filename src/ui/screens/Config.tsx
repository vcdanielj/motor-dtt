import { useMemo, useState, type ChangeEvent } from 'react'
import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'

export default function Config() {
  const seeds = useStore((s) => s.seeds)
  const learned = useStore((s) => s.learned)
  const thresholds = useStore((s) => s.thresholds)
  const saveThresholds = useStore((s) => s.saveThresholds)
  const exportLearnedDiccionario = useStore((s) => s.exportLearnedDiccionario)
  const exportManualMaestro = useStore((s) => s.exportManualMaestro)
  const importDiccionarioCsv = useStore((s) => s.importDiccionarioCsv)
  const importClientesTemplate = useStore((s) => s.importClientesTemplate)
  const resetLearned = useStore((s) => s.resetLearned)

  const macroCount = useMemo(() => new Set(seeds.segmentos.map((s) => s.macroN1)).size, [seeds.segmentos])
  const ciudadCount = Object.keys(seeds.ciudadEstado).length

  // Threshold inputs are local so the analyst can type freely before saving; re-synced to the
  // store during render (not an effect) whenever the store's thresholds object changes identity —
  // initial load from meta, or the clamped values after a save.
  const [thresholdInput, setThresholdInput] = useState(thresholds.fuzzyThreshold)
  const [floorInput, setFloorInput] = useState(thresholds.fuzzySuggestFloor)
  const [syncedThresholds, setSyncedThresholds] = useState(thresholds)
  if (syncedThresholds !== thresholds) {
    setSyncedThresholds(thresholds)
    setThresholdInput(thresholds.fuzzyThreshold)
    setFloorInput(thresholds.fuzzySuggestFloor)
  }

  const [savingThresholds, setSavingThresholds] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importingClientes, setImportingClientes] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3600)
  }

  const handleSaveThresholds = async () => {
    setSavingThresholds(true)
    try {
      await saveThresholds(thresholdInput, floorInput)
      showToast('Umbrales guardados — se aplican en la próxima corrida.')
    } finally {
      setSavingThresholds(false)
    }
  }

  const handleImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file name later
    if (!file) return
    setImporting(true)
    try {
      const { added, skipped } = await importDiccionarioCsv(file)
      showToast(`${added} añadidas · ${skipped} omitidas`)
    } finally {
      setImporting(false)
    }
  }

  const handleImportClientesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file name later
    if (!file) return
    setImportingClientes(true)
    try {
      const { added, skipped } = await importClientesTemplate(file)
      showToast(`${added} clientes importados · ${skipped} omitidos/incorrectos`)
    } catch (err) {
      showToast((err as Error).message || 'Error al importar plantilla de clientes')
    } finally {
      setImportingClientes(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetLearned()
      setConfirmingReset(false)
      showToast('Aprendizaje restablecido — diccionario y maestro aprendidos vaciados en este dispositivo.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Configuración</h1>
      <p className="mt-1 text-xs text-slate">
        Diccionario, maestro y catálogos versionados — la config y los crudos son la fuente de verdad; la base estandarizada es una vista derivada (R3).
      </p>

      {seeds.provenance.placeholder ? (
        <div className="mt-4 max-w-[760px] rounded-lg border border-gold bg-amber px-4 py-3 text-xs font-semibold leading-relaxed text-white">
          PLACEHOLDER — Catálogos de muestra — reemplazar con Entregable 3.1. Fuente: {seeds.provenance.source}
        </div>
      ) : (
        <div className="mt-4 max-w-[760px] rounded-lg border border-green bg-green/10 px-4 py-3 text-xs font-semibold leading-relaxed text-navy">
          Catálogo oficial (Entregable 2.1) cargado — {seeds.provenance.source}
        </div>
      )}

      {toast ? (
        <div role="status" className="mt-3 max-w-[760px] rounded-md bg-navy px-4 py-2 text-xs font-semibold text-white">
          {toast}
        </div>
      ) : null}

      <Card className="mt-4 max-w-[760px]">
        <div className="text-xs font-bold uppercase tracking-wide text-navy">Catálogos cargados</div>
        <dl className="mt-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <dt className="w-56 flex-none text-slate">Segmentos N3</dt>
            <dd className="font-mono font-semibold text-navy">{seeds.segmentos.length}</dd>
            <dt className="ml-6 w-40 flex-none text-slate">Macro-canales N1</dt>
            <dd className="font-mono font-semibold text-navy">{macroCount}</dd>
          </div>
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <dt className="w-56 flex-none text-slate">Estados</dt>
            <dd className="font-mono font-semibold text-navy">{seeds.estados.length}</dd>
          </div>
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <dt className="w-56 flex-none text-slate">Entradas de diccionario</dt>
            <dd className="font-mono font-semibold text-navy">{seeds.diccionario.length}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-56 flex-none text-slate">Pares ciudad → estado</dt>
            <dd className="font-mono font-semibold text-navy">{ciudadCount}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-4 max-w-[760px]">
        <div className="text-xs font-bold uppercase tracking-wide text-navy">Umbrales de fuzzy matching</div>
        <div className="mt-1 text-[11px] text-slate">
          ≥ umbral se clasifica automáticamente por fuzzy; entre el piso y el umbral, va a la cola de revisión como
          sugerencia. Se guardan en este dispositivo (IndexedDB) y se aplican desde la próxima corrida o exportación.
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-slate">Umbral fuzzy (auto-resolución)</span>
            <input
              type="number"
              min={floorInput}
              max={100}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Number(e.target.value))}
              className="w-24 rounded border border-line bg-white px-2 py-1 font-mono outline-none focus:border-navy"
              aria-label="Umbral fuzzy"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate">Piso de sugerencia</span>
            <input
              type="number"
              min={50}
              max={99}
              value={floorInput}
              onChange={(e) => setFloorInput(Number(e.target.value))}
              className="w-24 rounded border border-line bg-white px-2 py-1 font-mono outline-none focus:border-navy"
              aria-label="Piso de sugerencia"
            />
          </label>
          <button
            type="button"
            disabled={savingThresholds}
            onClick={handleSaveThresholds}
            className="rounded bg-navy px-3 py-1.5 text-xs font-semibold text-panel hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar umbrales
          </button>
        </div>
      </Card>

      <Card className="mt-4 max-w-[760px]">
        <div className="text-xs font-bold uppercase tracking-wide text-navy">Aprendizaje persistido</div>
        <div className="mt-1 text-[11px] text-slate">
          Entradas enseñadas por el analista, guardadas en este dispositivo (IndexedDB) y aplicadas en la próxima
          corrida — todo local, sin sincronización con ningún servidor ni otros equipos.
        </div>
        <dl className="mt-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <dt className="w-56 flex-none text-slate">Entradas de diccionario aprendidas</dt>
            <dd className="font-mono font-semibold text-navy">{learned.diccionario}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-56 flex-none text-slate">Clasificaciones manuales de maestro</dt>
            <dd className="font-mono font-semibold text-navy">{learned.maestro}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => void exportLearnedDiccionario()}
            className="rounded border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line/30"
          >
            Exportar diccionario
          </button>
          <button
            type="button"
            onClick={() => void exportManualMaestro()}
            className="rounded border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line/30"
          >
            Exportar maestro
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line/30">
            {importing ? 'Importando…' : 'Importar diccionario (CSV)'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => void handleImportChange(e)}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line/30">
            {importingClientes ? 'Importando…' : 'Importar planilla de clientes (XLSX / CSV)'}
            <input
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={importingClientes}
              onChange={(e) => void handleImportClientesChange(e)}
            />
          </label>

          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="ml-auto rounded border border-red/60 px-3 py-1.5 text-xs font-semibold text-red hover:bg-red/10"
            >
              Restablecer aprendizaje
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-red">¿Seguro? Se borra todo lo aprendido.</span>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleReset()}
                className="rounded bg-red px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sí, restablecer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="rounded border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line/30"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
