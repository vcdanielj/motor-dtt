import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import { SearchBox, SubTab } from './icons'

type Sub = 'segmentos' | 'estados' | 'estadoDiccionario' | 'ciudadEstado' | 'diccionario'

/** Case-insensitive "any field contains the query"; an empty query matches everything. Defined at
 *  module scope so it is a stable reference and the memos can depend on (list, query) alone. */
const matches = (q: string, ...fields: string[]) =>
  !q || fields.some((f) => f.toLowerCase().includes(q))

/** Tab 2: read-only browser over the embedded seed catalogs, including the estado variant
 *  dictionary that drives the DICCIONARIO step of the state cascade. */
export default function CatalogosTab() {
  const seeds = useStore((s) => s.seeds)
  const [sub, setSub] = useState<Sub>('segmentos')
  const [query, setQuery] = useState('')

  const q = query.toLowerCase().trim()

  const segmentos = useMemo(
    () => seeds.segmentos.filter((s) => matches(q, s.n3, s.macroN1, s.codigo)),
    [seeds.segmentos, q],
  )
  const estados = useMemo(() => seeds.estados.filter((e) => matches(q, e)), [seeds.estados, q])
  const estadoDiccionario = useMemo(
    () => seeds.estadoDiccionario.filter((e) => matches(q, e.variante, e.estadoStd)),
    [seeds.estadoDiccionario, q],
  )
  const ciudadEstado = useMemo(
    () => Object.entries(seeds.ciudadEstado).filter(([c, e]) => matches(q, c, e)),
    [seeds.ciudadEstado, q],
  )
  const diccionario = useMemo(
    () => seeds.diccionario.filter((d) => matches(q, d.variante, d.segmentoN3, d.macroN1)),
    [seeds.diccionario, q],
  )

  const cambiar = (next: Sub) => { setSub(next); setQuery('') }

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-3 mb-4">
          <div className="flex flex-wrap gap-1">
            <SubTab active={sub === 'segmentos'} onClick={() => cambiar('segmentos')}>
              Segmentos ({segmentos.length})
            </SubTab>
            <SubTab active={sub === 'estados'} onClick={() => cambiar('estados')}>
              Estados ({estados.length})
            </SubTab>
            <SubTab active={sub === 'estadoDiccionario'} onClick={() => cambiar('estadoDiccionario')}>
              Diccionario de Estados ({estadoDiccionario.length})
            </SubTab>
            <SubTab active={sub === 'ciudadEstado'} onClick={() => cambiar('ciudadEstado')}>
              Ciudad-Estado ({ciudadEstado.length})
            </SubTab>
            <SubTab active={sub === 'diccionario'} onClick={() => cambiar('diccionario')}>
              Diccionario Semilla ({diccionario.length})
            </SubTab>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar en catálogo..." />
        </div>

        <div className={sub === 'segmentos' ? '' : 'hidden'}>
          <div className="max-h-[480px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Código DTT</th>
                  <th className="px-4 py-2.5">Segmento (N3)</th>
                  <th className="px-4 py-2.5">Macro Canal (N1)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {segmentos.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate">No se encontraron segmentos en el catálogo.</td></tr>
                ) : (
                  segmentos.map((s, idx) => (
                    <tr key={s.codigo + idx} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{s.codigo}</td>
                      <td className="px-4 py-2 font-semibold text-ink">{s.n3}</td>
                      <td className="px-4 py-2 text-slate">{s.macroN1}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sub === 'estados' ? '' : 'hidden'}>
          <div className="max-h-[480px] overflow-y-auto border border-line rounded-lg">
            <ul className="divide-y divide-line">
              {estados.length === 0 ? (
                <li className="px-4 py-8 text-center text-slate text-xs">No se encontraron estados.</li>
              ) : (
                estados.map((e, idx) => (
                  <li key={e + idx} className="px-4 py-2.5 text-xs text-ink font-semibold flex items-center gap-2 hover:bg-bg/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-navy/40"></span>
                    {e}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className={sub === 'estadoDiccionario' ? '' : 'hidden'}>
          <p className="text-[11px] text-slate mb-2">
            Variantes crudas que el motor sabe traducir al catálogo oficial: abreviaturas, renombres
            (La Guaira → Vargas) y errores de escritura frecuentes. El prefijo &quot;EDO&quot;/&quot;ESTADO&quot; y los
            códigos numéricos se limpian por regla, sin necesidad de listarlos aquí.
          </p>
          <div className="max-h-[440px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Variante Cruda</th>
                  <th className="px-4 py-2.5">Estado Oficial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {estadoDiccionario.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-8 text-center text-slate">No se encontraron variantes de estado.</td></tr>
                ) : (
                  estadoDiccionario.map((e, idx) => (
                    <tr key={e.variante + idx} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{e.variante}</td>
                      <td className="px-4 py-2 text-ink font-semibold">{e.estadoStd}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sub === 'ciudadEstado' ? '' : 'hidden'}>
          <div className="max-h-[480px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Ciudad / Municipio</th>
                  <th className="px-4 py-2.5">Estado Federal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ciudadEstado.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-8 text-center text-slate">No se encontraron correspondencias de ciudad.</td></tr>
                ) : (
                  ciudadEstado.map(([ciudad, estado], idx) => (
                    <tr key={ciudad + idx} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-semibold text-ink">{ciudad}</td>
                      <td className="px-4 py-2 text-slate">{estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sub === 'diccionario' ? '' : 'hidden'}>
          <div className="max-h-[480px] overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg text-slate font-bold sticky top-0 uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Variante Cruda (Semilla)</th>
                  <th className="px-4 py-2.5">Asignación Directa N3</th>
                  <th className="px-4 py-2.5">Macro Canal N1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {diccionario.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate">No se encontraron variantes coincidentes.</td></tr>
                ) : (
                  diccionario.map((d, idx) => (
                    <tr key={d.variante + idx} className="hover:bg-bg/40">
                      <td className="px-4 py-2 font-mono font-bold text-navy">{d.variante}</td>
                      <td className="px-4 py-2 text-ink font-semibold">{d.segmentoN3}</td>
                      <td className="px-4 py-2 text-slate">{d.macroN1}</td>
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
