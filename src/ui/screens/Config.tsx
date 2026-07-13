import { useMemo } from 'react'
import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'

export default function Config() {
  const seeds = useStore((s) => s.seeds)
  const learned = useStore((s) => s.learned)

  const macroCount = useMemo(() => new Set(seeds.segmentos.map((s) => s.macroN1)).size, [seeds.segmentos])
  const ciudadCount = Object.keys(seeds.ciudadEstado).length

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
        <div className="text-xs font-bold uppercase tracking-wide text-navy">Aprendizaje persistido</div>
        <div className="mt-1 text-[11px] text-slate">
          Solo lectura — entradas enseñadas por el analista, guardadas en este dispositivo (IndexedDB) y aplicadas en la próxima corrida.
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
      </Card>

      <Card className="mt-4 max-w-[760px]">
        <div className="text-xs font-bold uppercase tracking-wide text-navy">Umbrales de fuzzy matching</div>
        <div className="mt-1 text-[11px] text-slate">Solo lectura — edición en un sprint posterior.</div>
        <dl className="mt-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <dt className="w-56 flex-none text-slate">Umbral fuzzy (auto-resolución)</dt>
            <dd className="font-mono font-semibold text-navy">92</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-56 flex-none text-slate">Piso de sugerencia</dt>
            <dd className="font-mono font-semibold text-navy">80</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
