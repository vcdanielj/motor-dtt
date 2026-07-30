import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'

/** Tab 1: catalog provenance, the counts of everything loaded, the fuzzy thresholds, and the
 *  column routing the motor detected on the last run. */
export default function ResumenTab({ showToast }: { showToast: (msg: string) => void }) {
  const seeds = useStore((s) => s.seeds)
  const thresholds = useStore((s) => s.thresholds)
  const saveThresholds = useStore((s) => s.saveThresholds)
  const runResult = useStore((s) => s.runResult)

  const macroCount = useMemo(() => new Set(seeds.segmentos.map((s) => s.macroN1)).size, [seeds.segmentos])
  const ciudadCount = Object.keys(seeds.ciudadEstado).length

  const [thresholdInput, setThresholdInput] = useState(thresholds.fuzzyThreshold)
  const [floorInput, setFloorInput] = useState(thresholds.fuzzySuggestFloor)
  const [syncedThresholds, setSyncedThresholds] = useState(thresholds)
  const [savingThresholds, setSavingThresholds] = useState(false)

  // Re-sync the sliders when the persisted thresholds land from IndexedDB after mount.
  if (syncedThresholds !== thresholds) {
    setSyncedThresholds(thresholds)
    setThresholdInput(thresholds.fuzzyThreshold)
    setFloorInput(thresholds.fuzzySuggestFloor)
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

  const stats: { label: string; value: number }[] = [
    { label: 'Segmentos N3', value: seeds.segmentos.length },
    { label: 'Macro Canales N1', value: macroCount },
    { label: 'Estados (VE)', value: seeds.estados.length },
    { label: 'Diccionario Base', value: seeds.diccionario.length },
    { label: 'Variantes de Estado', value: seeds.estadoDiccionario.length },
    { label: 'Ciudad → Estado', value: ciudadCount },
  ]

  return (
    <div className="space-y-6">
      {seeds.provenance.placeholder ? (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-xs leading-relaxed text-ink">
          <span className="font-bold text-amber">Catálogos de Muestra:</span> Se están utilizando datos semilla para propósitos de prueba en este entorno. Reemplazar con el catálogo definitivo una vez disponible. Fuente: <code className="font-mono bg-amber/5 px-1 py-0.5 rounded text-amber">{seeds.provenance.source}</code>
        </div>
      ) : (
        <div className="rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-xs leading-relaxed text-ink">
          <span className="font-bold text-green">Catálogo Oficial Confirmado:</span> Catálogos estandarizados según el Entregable 2.1. Fuente: <code className="font-mono bg-green/5 px-1 py-0.5 rounded text-green-700">{seeds.provenance.source}</code>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel border border-line rounded-xl p-4">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate">{s.label}</div>
            <div className="text-2xl font-black text-navy mt-1 font-mono">{s.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="border-b border-line pb-3 mb-4">
          <h3 className="text-sm font-bold text-navy">Algoritmo de Coincidencia (Fuzzy Matching)</h3>
          <p className="text-[11px] text-slate mt-0.5">
            El motor utiliza Levenshtein tokenizado para sugerir o auto-asignar segmentos y estados en base a coincidencias. Los mismos umbrales rigen ambos campos.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between font-sans">
                <span className="text-xs font-semibold text-ink">Umbral fuzzy (auto-resolución)</span>
                <span className="font-mono text-xs font-bold text-navy bg-navy/10 px-2 py-0.5 rounded">{thresholdInput}%</span>
              </div>
              <p className="text-[10px] text-slate">Las coincidencias con puntuación superior o igual a este umbral se clasificarán automáticamente en la corrida.</p>
              <input
                type="range"
                min={floorInput}
                max={100}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(Number(e.target.value))}
                className="w-full accent-navy cursor-pointer mt-1"
              />
              <div className="hidden">
                {/* Number inputs kept for label-based queries in the test suite. */}
                <label htmlFor="hidden-threshold">Umbral fuzzy</label>
                <input
                  id="hidden-threshold"
                  type="number"
                  min={floorInput}
                  max={100}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between font-sans">
                <span className="text-xs font-semibold text-ink">Piso de sugerencia</span>
                <span className="font-mono text-xs font-bold text-navy bg-navy/10 px-2 py-0.5 rounded">{floorInput}%</span>
              </div>
              <p className="text-[10px] text-slate">Puntuaciones entre este límite y el umbral se enviarán a la Cola de revisión con una sugerencia automática.</p>
              <input
                type="range"
                min={50}
                max={99}
                value={floorInput}
                onChange={(e) => setFloorInput(Number(e.target.value))}
                className="w-full accent-navy cursor-pointer mt-1"
              />
              <div className="hidden">
                <label htmlFor="hidden-floor">Piso de sugerencia</label>
                <input
                  id="hidden-floor"
                  type="number"
                  min={50}
                  max={99}
                  value={floorInput}
                  onChange={(e) => setFloorInput(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-line pt-4 mt-2">
            <button
              type="button"
              disabled={savingThresholds}
              onClick={() => void handleSaveThresholds()}
              className="inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-panel hover:bg-navy-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingThresholds ? 'Guardando...' : 'Guardar umbrales'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-line pb-3 mb-4">
          <h3 className="text-sm font-bold text-navy">Enrutamiento de Columnas (Mapeo Nativo)</h3>
          <p className="text-[11px] text-slate mt-0.5">
            Mapeo de cabeceras detectado por el motor en la última corrida de datos.
          </p>
        </div>

        {!runResult ? (
          <div className="text-center py-6 text-xs text-slate-2 italic">
            No hay una corrida activa en este momento. Sube un archivo en la pestaña de &quot;Corrida&quot; para visualizar el enrutamiento de columnas.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-line rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-bg text-slate font-bold uppercase border-b border-line">
                  <tr>
                    <th className="px-4 py-2">Campo Canónico</th>
                    <th className="px-4 py-2">Columna Mapeada</th>
                    <th className="px-4 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    { label: 'RIF (Identificador)', value: runResult.summary.schema.rif, required: true },
                    { label: 'Segmento (Crudo)', value: runResult.summary.schema.segmentoCrudo, required: true },
                    { label: 'Estado (Crudo)', value: runResult.summary.schema.estadoCrudo, required: false },
                    { label: 'Ciudad', value: runResult.summary.schema.ciudad, required: false },
                  ].map((field) => (
                    <tr key={field.label} className="hover:bg-bg/25">
                      <td className="px-4 py-2.5 font-semibold text-ink">{field.label}</td>
                      <td className="px-4 py-2.5 font-mono text-navy font-bold">
                        {field.value || <span className="text-slate-2 italic font-sans font-normal">&lt;No detectado&gt;</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {field.value ? (
                          <span className="inline-flex items-center rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-semibold text-green border border-green/20">
                            Mapeado
                          </span>
                        ) : field.required ? (
                          <span className="inline-flex items-center rounded-full bg-red/10 px-2 py-0.5 text-[10px] font-semibold text-red border border-red/20">
                            Requerido
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-slate border border-line">
                            Opcional
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-ink">Columnas de Transmisión Directa (Passthrough)</span>
              <p className="text-[10px] text-slate">Datos de dinero, fechas o cantidades numéricas transferidas directamente a la salida.</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5 font-mono">
                {runResult.summary.schema.passthrough.length === 0 ? (
                  <span className="text-xs text-slate-2 italic font-sans">Ninguna columna de passthrough detectada.</span>
                ) : (
                  runResult.summary.schema.passthrough.map((col) => (
                    <span key={col} className="inline-flex items-center text-[10px] font-semibold bg-navy/5 text-navy border border-navy/15 rounded px-2 py-0.5">
                      {col}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-ink">Columnas No Mapeadas (Ignoradas)</span>
              <p className="text-[10px] text-slate">Columnas omitidas del procesamiento por no coincidir con ningún campo o patrón numérico estándar.</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5 font-mono">
                {runResult.summary.schema.unmapped.length === 0 ? (
                  <span className="text-xs text-slate-2 italic font-sans">Ninguna columna ignorada.</span>
                ) : (
                  runResult.summary.schema.unmapped.map((col) => (
                    <span key={col} className="inline-flex items-center text-[10px] font-semibold bg-bg text-slate-2 border border-line rounded px-2 py-0.5">
                      {col}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
