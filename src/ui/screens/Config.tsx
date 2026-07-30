import { useState } from 'react'
import { useStore } from '@/state/store'
import { ActionIcon, BrainIcon, CatalogIcon, GearIcon, StatsIcon } from './config/icons'
import ResumenTab from './config/ResumenTab'
import CatalogosTab from './config/CatalogosTab'
import AprendizajeTab from './config/AprendizajeTab'
import AccionesTab from './config/AccionesTab'

type Tab = 'resumen' | 'catalogos' | 'aprendizaje' | 'acciones'

/** Shell for the Configuración screen: header, toast host and left-rail navigation. Each tab's
 *  content lives in its own module under ./config — this file only routes between them.
 *
 *  Tabs are hidden with a class rather than unmounted so tests can query across all of them and
 *  so per-tab local state (search boxes, threshold sliders) survives navigation. */
export default function Config() {
  const seeds = useStore((s) => s.seeds)
  const learned = useStore((s) => s.learned)

  const [activeTab, setActiveTab] = useState<Tab>('resumen')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3600)
  }

  const totalAprendido = learned.diccionario + learned.estadoDiccionario + learned.maestro

  const tabs: { key: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: 'resumen', icon: <StatsIcon />, label: 'Resumen y Umbrales' },
    { key: 'catalogos', icon: <CatalogIcon />, label: `Catálogos Base (${seeds.segmentos.length})` },
    { key: 'aprendizaje', icon: <BrainIcon />, label: 'Base de Conocimiento', badge: totalAprendido },
    { key: 'acciones', icon: <ActionIcon />, label: 'Acciones de Datos' },
  ]

  return (
    <div className="max-w-[1240px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy flex items-center gap-2">
            <span className="p-1.5 bg-navy/10 rounded text-navy">
              <GearIcon />
            </span>
            Configuración del Motor
          </h1>
          <p className="mt-1.5 text-xs text-slate max-w-[800px] leading-relaxed">
            Gestión de catálogos maestros de Heinz, umbrales del algoritmo de coincidencia fuzzy, y base de conocimiento de aprendizaje persistida de manera local en el navegador (IndexedDB).
          </p>
        </div>

        <div className="flex-none">
          {seeds.provenance.placeholder ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-amber border border-amber/30">
              <span className="w-2 h-2 rounded-full bg-amber animate-pulse"></span>
              Catálogos de Muestra (Semilla)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 px-3 py-1 text-xs font-semibold text-green border border-green/30">
              <span className="w-2 h-2 rounded-full bg-green"></span>
              Catálogo Oficial Cargado
            </span>
          )}
        </div>
      </div>

      {toast ? (
        <div role="status" className="mb-4 max-w-[760px] rounded-lg bg-navy shadow-md p-3 flex items-center justify-between text-xs font-semibold text-white animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-amber">●</span>
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-panel/60 hover:text-white font-mono text-sm ml-4">×</button>
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-64 flex-none">
          <div className="bg-panel border border-line rounded-xl p-3 flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible">
            {tabs.map((t) => {
              const active = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center ${t.badge === undefined ? 'justify-start' : 'justify-between'} px-4 py-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal ${
                    active ? 'bg-navy text-panel shadow-sm' : 'text-slate hover:bg-bg hover:text-navy'
                  }`}
                >
                  <span className="flex items-center">
                    {t.icon}
                    {t.label}
                  </span>
                  {t.badge === undefined ? null : (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${active ? 'bg-panel/20 text-panel' : 'bg-line/60 text-navy'}`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className={activeTab === 'resumen' ? '' : 'hidden'}>
            <ResumenTab showToast={showToast} />
          </div>
          <div className={activeTab === 'catalogos' ? '' : 'hidden'}>
            <CatalogosTab />
          </div>
          <div className={activeTab === 'aprendizaje' ? '' : 'hidden'}>
            <AprendizajeTab showToast={showToast} />
          </div>
          <div className={activeTab === 'acciones' ? '' : 'hidden'}>
            <AccionesTab showToast={showToast} />
          </div>
        </div>
      </div>
    </div>
  )
}
