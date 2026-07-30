import { useState, type ChangeEvent } from 'react'
import { useStore } from '@/state/store'

/** A file-picker styled as a button, with an inline spinner while its handler runs. */
function ImportButton({
  label, accept, busy, onFile,
}: {
  label: string
  accept: string
  busy: boolean
  onFile: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-line bg-panel px-4 py-2 text-xs font-bold text-navy hover:bg-bg transition-all">
      {busy ? (
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-t-transparent border-navy animate-spin"></span>
          Importando…
        </span>
      ) : (
        label
      )}
      <input type="file" accept={accept} className="hidden" disabled={busy} onChange={onFile} />
    </label>
  )
}

const XLSX_ACCEPT =
  '.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Tab 4: import/export of everything learned, plus the destructive reset. */
export default function AccionesTab({ showToast }: { showToast: (msg: string) => void }) {
  const learned = useStore((s) => s.learned)
  const exportLearnedDiccionario = useStore((s) => s.exportLearnedDiccionario)
  const exportLearnedEstados = useStore((s) => s.exportLearnedEstados)
  const exportManualMaestro = useStore((s) => s.exportManualMaestro)
  const importDiccionarioCsv = useStore((s) => s.importDiccionarioCsv)
  const importEstadoDiccionarioCsv = useStore((s) => s.importEstadoDiccionarioCsv)
  const importClientesTemplate = useStore((s) => s.importClientesTemplate)
  const resetLearned = useStore((s) => s.resetLearned)

  const [busy, setBusy] = useState<'diccionario' | 'estados' | 'clientes' | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const importar = async (
    key: 'diccionario' | 'estados' | 'clientes',
    e: ChangeEvent<HTMLInputElement>,
    run: (file: File) => Promise<{ added: number; skipped: number }>,
    mensaje: (r: { added: number; skipped: number }) => string,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(key)
    try {
      showToast(mensaje(await run(file)))
    } catch (err) {
      showToast((err as Error).message || 'Error al importar el archivo')
    } finally {
      setBusy(null)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetLearned()
      setConfirmingReset(false)
      showToast('Aprendizaje restablecido — diccionarios y maestro aprendidos vaciados en este dispositivo.')
    } finally {
      setResetting(false)
    }
  }

  const counts: { label: string; value: number }[] = [
    { label: 'Entradas de diccionario aprendidas', value: learned.diccionario },
    { label: 'Variantes de estado aprendidas', value: learned.estadoDiccionario },
    { label: 'Clasificaciones manuales de maestro', value: learned.maestro },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-panel border border-line rounded-xl p-4">
        <h3 className="text-sm font-bold text-navy mb-1">Aprendizaje persistido</h3>
        <p className="text-[11px] text-slate leading-relaxed mb-4">
          Entradas enseñadas por el analista, guardadas en este dispositivo (IndexedDB) y aplicadas en la próxima corrida — todo local, sin sincronización con ningún servidor ni otros equipos.
        </p>

        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-4">
          {counts.map((c) => (
            <div key={c.label} className="flex items-center justify-between border-b border-line pb-2">
              <dt className="text-slate">{c.label}</dt>
              <dd className="font-mono font-bold text-navy bg-bg px-2 py-0.5 rounded">{c.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => void exportLearnedDiccionario()}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-panel px-4 py-2 text-xs font-bold text-navy hover:bg-bg transition-all"
          >
            Exportar diccionario
          </button>

          <button
            type="button"
            onClick={() => void exportLearnedEstados()}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-panel px-4 py-2 text-xs font-bold text-navy hover:bg-bg transition-all"
          >
            Exportar diccionario de estados
          </button>

          <button
            type="button"
            onClick={() => void exportManualMaestro()}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-panel px-4 py-2 text-xs font-bold text-navy hover:bg-bg transition-all"
          >
            Exportar maestro
          </button>

          <ImportButton
            label="Importar diccionario (CSV)"
            accept=".csv,text/csv"
            busy={busy === 'diccionario'}
            onFile={(e) => void importar('diccionario', e, importDiccionarioCsv,
              ({ added, skipped }) => `${added} añadidas · ${skipped} omitidas`)}
          />

          <ImportButton
            label="Importar diccionario de estados (CSV)"
            accept=".csv,text/csv"
            busy={busy === 'estados'}
            onFile={(e) => void importar('estados', e, importEstadoDiccionarioCsv,
              ({ added, skipped }) => `${added} variantes de estado añadidas · ${skipped} omitidas`)}
          />

          <ImportButton
            label="Importar planilla de clientes (XLSX / CSV)"
            accept={XLSX_ACCEPT}
            busy={busy === 'clientes'}
            onFile={(e) => void importar('clientes', e, importClientesTemplate,
              ({ added, skipped }) => `${added} clientes importados · ${skipped} omitidos/incorrectos`)}
          />
        </div>

        <p className="text-[10px] text-slate mt-3 leading-relaxed">
          El CSV de estados espera las columnas <code className="font-mono">variante</code> y{' '}
          <code className="font-mono">estado_std</code>; cada estado debe coincidir con el catálogo oficial de 24.
          La planilla de clientes acepta tanto el formato con estilo (encabezados en la fila 4) como el plano.
        </p>
      </div>

      <div className="bg-panel border border-red/20 rounded-xl p-4">
        <h3 className="text-sm font-bold text-red mb-1">Zona de Riesgo</h3>
        <p className="text-[11px] text-slate leading-relaxed mb-4">
          El borrado restablece de manera irreversible todas las asignaciones personalizadas y los diccionarios entrenados por el analista en este dispositivo.
        </p>

        {!confirmingReset ? (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="inline-flex items-center justify-center rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-xs font-bold text-red hover:bg-red hover:text-panel transition-all"
            >
              Restablecer aprendizaje
            </button>
          </div>
        ) : (
          <div className="bg-red/5 border border-red/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-red">¿Confirmas la acción de restablecer?</span>
              <span className="text-[10px] text-slate">Se borrarán de forma permanente todos los datos guardados en IndexedDB.</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleReset()}
                className="rounded-lg bg-red px-3 py-1.5 text-xs font-bold text-white hover:bg-red-deep disabled:opacity-40 transition-all"
              >
                Sí, restablecer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-bold text-navy hover:bg-bg transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
