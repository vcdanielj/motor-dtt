import { useState, useMemo, type ChangeEvent } from 'react'
import { useStore } from '@/state/store'
import type { ClienteAliasEntry } from '@/contracts/config'
import Card from '@/ui/components/Card'
import Badge from '@/ui/components/Badge'

export default function Homologacion() {
  const learnedAliasesList = useStore((s) => s.learnedAliasesList)
  const putLearnedAlias = useStore((s) => s.putLearnedAlias)
  const deleteLearnedAlias = useStore((s) => s.deleteLearnedAlias)
  const importAliasesCsv = useStore((s) => s.importAliasesCsv)
  const exportLearnedAliases = useStore((s) => s.exportLearnedAliases)
  const estados = useStore((s) => s.seeds.estados)

  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [busyImport, setBusyImport] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  // Form state for creating a new alias
  const [formData, setFormData] = useState({
    distribuidor: '',
    codigoCliente: '',
    rifCanonico: '',
    razonSocial: '',
    estadoStd: '',
  })

  const showToastMsg = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3600)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return learnedAliasesList
    return learnedAliasesList.filter(
      (a) =>
        a.distribuidor.toLowerCase().includes(q) ||
        a.codigoCliente.toLowerCase().includes(q) ||
        a.rifCanonico.toLowerCase().includes(q) ||
        (a.razonSocial ?? '').toLowerCase().includes(q) ||
        (a.estadoStd ?? '').toLowerCase().includes(q),
    )
  }, [learnedAliasesList, query])

  const distribuidoresUnicos = useMemo(() => {
    return new Set(learnedAliasesList.map((a) => a.distribuidor)).size
  }, [learnedAliasesList])

  const handleSaveNewAlias = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.distribuidor.trim() || !formData.codigoCliente.trim() || !formData.rifCanonico.trim()) {
      showToastMsg('Por favor completa Distribuidor, Código de Cliente y RIF Canónico.')
      return
    }

    const entry: ClienteAliasEntry = {
      distribuidor: formData.distribuidor.trim(),
      codigoCliente: formData.codigoCliente.trim(),
      rifCanonico: formData.rifCanonico.trim(),
      razonSocial: formData.razonSocial.trim() || undefined,
      estadoStd: formData.estadoStd.trim() || undefined,
      activa: true,
    }

    await putLearnedAlias(entry)
    setShowModal(false)
    setFormData({ distribuidor: '', codigoCliente: '', rifCanonico: '', razonSocial: '', estadoStd: '' })
    showToastMsg(`Alias para "${entry.codigoCliente}" de ${entry.distribuidor} guardado con éxito.`)
  }

  const handleDelete = async (distribuidor: string, codigoCliente: string) => {
    const key = `${distribuidor}::${codigoCliente}`
    setDeletingKey(key)
    try {
      await deleteLearnedAlias(distribuidor, codigoCliente)
      showToastMsg(`Homologación eliminada para ${codigoCliente} (${distribuidor}).`)
    } finally {
      setDeletingKey(null)
    }
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusyImport(true)
    try {
      const res = await importAliasesCsv(file)
      showToastMsg(`Importación lista: ${res.added} alias añadidos · ${res.skipped} omitidos.`)
    } catch (err) {
      showToastMsg((err as Error).message || 'Error al importar archivo CSV.')
    } finally {
      setBusyImport(false)
    }
  }

  return (
    <div className="max-w-[1240px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-navy">Homologación de Códigos (Alias)</h1>
            <Badge label="Mapeo Distribuidor" variant="navy" />
          </div>
          <p className="mt-1.5 text-xs text-slate max-w-[820px] leading-relaxed">
            Permite asociar códigos internos de distribuidores que no reportan RIF (como el código <em>BAR-00236</em> de Campesino) a su RIF canónico y razón social oficial, evitando filas no identificadas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void exportLearnedAliases()}
            className="rounded-md border border-line bg-panel px-3.5 py-2 text-xs font-bold text-navy hover:bg-bg transition-all shadow-sm"
          >
            Exportar CSV
          </button>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-line bg-panel px-3.5 py-2 text-xs font-bold text-navy hover:bg-bg transition-all shadow-sm">
            {busyImport ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-t-transparent border-navy animate-spin"></span>
                Importando…
              </span>
            ) : (
              'Importar CSV'
            )}
            <input type="file" accept=".csv,text/csv" className="hidden" disabled={busyImport} onChange={handleImportFile} />
          </label>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-md bg-red px-4 py-2 text-xs font-bold text-white hover:bg-red-deep transition-all shadow-sm"
          >
            + Registrar Alias
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div role="status" className="mb-4 rounded-lg bg-navy shadow-md p-3 flex items-center justify-between text-xs font-semibold text-white animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-amber">●</span>
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-panel/60 hover:text-white font-mono text-sm ml-4">×</button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 border-l-4 border-l-navy">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider">Códigos Homologados</div>
          <div className="mt-1 text-2xl font-extrabold text-navy font-mono">{learnedAliasesList.length}</div>
          <div className="mt-1 text-[11px] text-slate">Mapeos activos en el motor</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-green">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider">Distribuidores Cubiertos</div>
          <div className="mt-1 text-2xl font-extrabold text-green font-mono">{distribuidoresUnicos}</div>
          <div className="mt-1 text-[11px] text-slate">Distribuidores con reglas de código</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-gold">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider">Efecto en Corrida</div>
          <div className="mt-1 text-xs font-bold text-navy">Recuperación 100% Automática</div>
          <div className="mt-1 text-[11px] text-slate">Asigna RIF canónico en streaming</div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por distribuidor, código interno, RIF o cliente…"
          className="w-full max-w-[460px] rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
        />
        <span className="text-xs text-slate">
          Mostrando <strong>{filtered.length}</strong> de {learnedAliasesList.length} registros
        </span>
      </div>

      {/* Main Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-bg text-slate font-bold uppercase border-b border-line">
            <tr>
              <th className="px-4 py-3">Distribuidor</th>
              <th className="px-4 py-3">Código Interno</th>
              <th className="px-4 py-3">RIF Canónico Resuelto</th>
              <th className="px-4 py-3">Razón Social Oficial</th>
              <th className="px-4 py-3">Estado Asignado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate">
                  {learnedAliasesList.length === 0 ? (
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="font-semibold text-navy text-sm">No hay códigos de clientes homologados aún</p>
                      <p className="text-xs text-slate leading-relaxed">
                        Puedes registrar alias individuales con el botón <strong>+ Registrar Alias</strong> o cargar un archivo CSV con columnas <code>distribuidor</code>, <code>codigo_cliente</code> y <code>rif_canonico</code>.
                      </p>
                    </div>
                  ) : (
                    'No se encontraron coincidencias para la búsqueda.'
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const key = `${item.distribuidor}::${item.codigoCliente}`
                return (
                  <tr key={key} className="hover:bg-bg/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-navy">{item.distribuidor}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-red bg-red/5 px-2 py-0.5 rounded w-max">
                      {item.codigoCliente}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-navy">
                      {item.rifCanonico}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink max-w-[240px] truncate" title={item.razonSocial ?? ''}>
                      {item.razonSocial || <span className="italic text-slate/60">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate font-medium">
                      {item.estadoStd || <span className="italic text-slate/60">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        disabled={deletingKey === key}
                        onClick={() => void handleDelete(item.distribuidor, item.codigoCliente)}
                        className="rounded px-2 py-1 text-xs text-red hover:bg-red/10 transition-all font-semibold disabled:opacity-40"
                        title="Eliminar homologación"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal for creating new alias */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-panel border border-line rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h2 className="text-base font-bold text-navy">Registrar Homologación de Código</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate hover:text-navy font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveNewAlias} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate mb-1">Nombre del Distribuidor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ALIMENTOS CAMPESINO o SUPLIMOS"
                  value={formData.distribuidor}
                  onChange={(e) => setFormData({ ...formData, distribuidor: e.target.value })}
                  className="w-full rounded border border-line px-3 py-2 text-ink outline-none focus:border-navy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate mb-1">Código Interno del Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: BAR-00236 o CLI-109"
                    value={formData.codigoCliente}
                    onChange={(e) => setFormData({ ...formData, codigoCliente: e.target.value })}
                    className="w-full rounded border border-line px-3 py-2 font-mono text-ink outline-none focus:border-navy"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate mb-1">RIF Canónico Real *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: J-402116012"
                    value={formData.rifCanonico}
                    onChange={(e) => setFormData({ ...formData, rifCanonico: e.target.value })}
                    className="w-full rounded border border-line px-3 py-2 font-mono text-ink outline-none focus:border-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate mb-1">Razón Social / Nombre Comercial (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: EMBUTIDOS CASA ITALIA C.A."
                  value={formData.razonSocial}
                  onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                  className="w-full rounded border border-line px-3 py-2 text-ink outline-none focus:border-navy"
                />
              </div>

              <div>
                <label className="block font-bold text-slate mb-1">Estado Sugerido (Opcional)</label>
                <select
                  value={formData.estadoStd}
                  onChange={(e) => setFormData({ ...formData, estadoStd: e.target.value })}
                  className="w-full rounded border border-line px-3 py-2 text-ink outline-none focus:border-navy bg-panel"
                >
                  <option value="">Seleccionar estado si aplica...</option>
                  {estados.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded px-4 py-2 font-bold text-slate hover:bg-bg border border-line"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-navy px-4 py-2 font-bold text-white hover:bg-navy-deep"
                >
                  Guardar Homologación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
