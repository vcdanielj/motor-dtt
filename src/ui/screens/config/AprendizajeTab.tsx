import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import { SearchBox, SubTab, TrashIcon } from './icons'

type Sub = 'diccionario' | 'estados' | 'ciudades' | 'maestro'

/** Case-insensitive "any field contains the query"; an empty query matches everything. Defined at
 *  module scope so it is a stable reference and the memos can depend on (list, query) alone. */
const matches = (q: string, ...fields: (string | null)[]) =>
  !q || fields.some((f) => (f ?? '').toLowerCase().includes(q))

/** Tab 3: everything the analyst has taught the motor, per store, with per-entry deletion.
 *  Three stores now: the segment dictionary, the estado dictionary, and the manual maestro. */
export default function AprendizajeTab({ showToast }: { showToast: (msg: string) => void }) {
  const learnedDiccionarioList = useStore((s) => s.learnedDiccionarioList)
  const learnedEstadoList = useStore((s) => s.learnedEstadoList)
  const learnedCiudadList = useStore((s) => s.learnedCiudadList)
  const manualMaestroList = useStore((s) => s.manualMaestroList)
  const deleteLearnedDiccionario = useStore((s) => s.deleteLearnedDiccionario)
  const deleteLearnedEstado = useStore((s) => s.deleteLearnedEstado)
  const deleteLearnedCiudad = useStore((s) => s.deleteLearnedCiudad)
  const deleteManualMaestro = useStore((s) => s.deleteManualMaestro)

  const [sub, setSub] = useState<Sub>('diccionario')
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const q = query.toLowerCase().trim()

  const diccionario = useMemo(
    () => learnedDiccionarioList.filter((d) => matches(q, d.variante, d.segmentoN3, d.macroN1)),
    [learnedDiccionarioList, q],
  )
  const estados = useMemo(
    () => learnedEstadoList.filter((e) => matches(q, e.variante, e.estadoStd)),
    [learnedEstadoList, q],
  )
  const ciudades = useMemo(
    () => learnedCiudadList.filter((c) => matches(q, c.ciudad, c.estadoStd)),
    [learnedCiudadList, q],
  )
  const maestro = useMemo(
    () => manualMaestroList.filter((m) => matches(q, m.rif, m.razonSocial, m.segmentoN3, m.macroN1, m.estadoHabitual)),
    [manualMaestroList, q],
  )

  const cambiar = (next: Sub) => { setSub(next); setQuery('') }

  const borrar = async (id: string, run: () => Promise<void>, mensaje: string) => {
    setDeletingId(id)
    try {
      await run()
      showToast(mensaje)
    } finally {
      setDeletingId(null)
    }
  }

  const vacio = (titulo: string, ayuda: string, hayDatos: boolean) =>
    hayDatos ? (
      'No se encontraron coincidencias para la búsqueda.'
    ) : (
      <div>
        <p className="font-semibold text-ink mb-1">{titulo}</p>
        <p className="text-[11px]">{ayuda}</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-3 mb-4">
          <div className="flex flex-wrap gap-1">
            <SubTab active={sub === 'diccionario'} onClick={() => cambiar('diccionario')}>
              Diccionario Aprendido ({diccionario.length})
            </SubTab>
            <SubTab active={sub === 'estados'} onClick={() => cambiar('estados')}>
              Estados Aprendidos ({estados.length})
            </SubTab>
            <SubTab active={sub === 'ciudades'} onClick={() => cambiar('ciudades')}>
              Ciudades Aprendidas ({ciudades.length})
            </SubTab>
            <SubTab active={sub === 'maestro'} onClick={() => cambiar('maestro')}>
              Maestro Manual ({maestro.length})
            </SubTab>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar conocimiento..." />
        </div>

        <div className={sub === 'diccionario' ? '' : 'hidden'}>
          <div className="max-h-[440px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Variante Aprendida</th>
                  <th className="px-4 py-2.5">Mapeado a Segmento</th>
                  <th className="px-4 py-2.5">Macro Canal</th>
                  <th className="px-4 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {diccionario.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate">
                      {vacio(
                        'No hay variantes aprendidas',
                        'Cuando clasifiques variantes de segmento en la cola de revisión se listarán aquí.',
                        learnedDiccionarioList.length > 0,
                      )}
                    </td>
                  </tr>
                ) : (
                  diccionario.map((item) => (
                    <tr key={item.variante} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{item.variante}</td>
                      <td className="px-4 py-2 text-ink font-semibold">{item.segmentoN3}</td>
                      <td className="px-4 py-2 text-slate">{item.macroN1}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === item.variante}
                          onClick={() => void borrar(
                            item.variante,
                            () => deleteLearnedDiccionario(item.variante),
                            `Variante "${item.variante}" eliminada del diccionario learned.`,
                          )}
                          className="p-1 rounded text-red hover:bg-red/10 transition-all hover:text-red-deep disabled:opacity-40"
                          title="Eliminar regla de diccionario"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sub === 'estados' ? '' : 'hidden'}>
          <div className="max-h-[440px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Variante Aprendida</th>
                  <th className="px-4 py-2.5">Mapeado a Estado</th>
                  <th className="px-4 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {estados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-slate">
                      {vacio(
                        'No hay estados aprendidos',
                        'Cuando resuelvas ítems de estado en la cola de revisión se listarán aquí.',
                        learnedEstadoList.length > 0,
                      )}
                    </td>
                  </tr>
                ) : (
                  estados.map((item) => (
                    <tr key={item.variante} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{item.variante}</td>
                      <td className="px-4 py-2 text-ink font-semibold">{item.estadoStd}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === item.variante}
                          onClick={() => void borrar(
                            item.variante,
                            () => deleteLearnedEstado(item.variante),
                            `Variante de estado "${item.variante}" eliminada.`,
                          )}
                          className="p-1 rounded text-red hover:bg-red/10 transition-all hover:text-red-deep disabled:opacity-40"
                          title="Eliminar variante de estado"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sub === 'ciudades' ? '' : 'hidden'}>
          <p className="text-[11px] text-slate mb-2">
            Ciudades, parroquias o nombres de ruta que le enseñaste al motor desde la cola. Es la
            única palanca para los nombres que cada distribuidor inventa —
            «EL PARAISO / LAS FUENTES», «CATIA / MANICOMIO»— y que ninguna semilla puede anticipar.
          </p>
          <div className="max-h-[440px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Ciudad</th>
                  <th className="px-4 py-2.5">Estado Asignado</th>
                  <th className="px-4 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ciudades.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-slate">
                      {vacio(
                        'No hay ciudades aprendidas',
                        'Cuando resuelvas ítems «Ciudad sin mapear» en la cola de revisión se listarán aquí.',
                        learnedCiudadList.length > 0,
                      )}
                    </td>
                  </tr>
                ) : (
                  ciudades.map((item) => (
                    <tr key={item.ciudad} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{item.ciudad}</td>
                      <td className="px-4 py-2 text-ink font-semibold">{item.estadoStd}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === item.ciudad}
                          onClick={() => void borrar(
                            item.ciudad,
                            () => deleteLearnedCiudad(item.ciudad),
                            `Ciudad "${item.ciudad}" eliminada del mapa aprendido.`,
                          )}
                          className="p-1 rounded text-red hover:bg-red/10 transition-all hover:text-red-deep disabled:opacity-40"
                          title="Eliminar ciudad aprendida"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sub === 'maestro' ? '' : 'hidden'}>
          <div className="max-h-[440px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">RIF</th>
                  <th className="px-4 py-2.5">Razón Social</th>
                  <th className="px-4 py-2.5">Segmento</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {maestro.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate">
                      {vacio(
                        'No hay clasificaciones manuales',
                        'Aparecerán aquí al resolver conflictos por RIF o al importar una planilla de clientes.',
                        manualMaestroList.length > 0,
                      )}
                    </td>
                  </tr>
                ) : (
                  maestro.map((item) => (
                    <tr key={item.rif} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{item.rif}</td>
                      <td className="px-4 py-2 text-ink font-semibold max-w-[200px] truncate" title={item.razonSocial ?? ''}>
                        {item.razonSocial || <span className="italic text-slate-2">-</span>}
                      </td>
                      <td className="px-4 py-2 text-ink font-semibold">
                        {item.segmentoN3 || <span className="italic text-slate-2">-</span>}
                      </td>
                      <td className="px-4 py-2 text-slate">
                        {item.estadoHabitual || <span className="italic text-slate-2">-</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === item.rif}
                          onClick={() => void borrar(
                            item.rif,
                            () => deleteManualMaestro(item.rif),
                            `RIF "${item.rif}" eliminado de las clasificaciones manuales.`,
                          )}
                          className="p-1 rounded text-red hover:bg-red/10 transition-all hover:text-red-deep disabled:opacity-40"
                          title="Eliminar clasificación manual"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
