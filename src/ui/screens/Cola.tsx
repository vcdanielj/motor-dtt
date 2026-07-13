import { useState } from 'react'
import { useStore } from '@/state/store'
import type { ColaTipo } from '@/contracts/cola'
import Badge, { type BadgeVariant } from '@/ui/components/Badge'
import Card from '@/ui/components/Card'

const fmt = new Intl.NumberFormat('es-VE')
const fmt1 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const TIPO_LABEL: Record<ColaTipo, string> = {
  VARIANTE_NUEVA: 'Variante nueva',
  CONFLICTO_MAYOR: 'Conflicto mayor',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'Alto volumen sin clasificar',
}

const TIPO_VARIANT: Record<ColaTipo, BadgeVariant> = {
  VARIANTE_NUEVA: 'amber',
  CONFLICTO_MAYOR: 'red',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'gold',
}

export default function Cola() {
  const cola = useStore((s) => s.cola)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const handleResolve = (valorCrudo: string) => {
    setToast(`«${valorCrudo}» guardado localmente — vista previa, la persistencia llega en Sprint 5.`)
    window.setTimeout(() => setToast(null), 3200)
  }

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Cola de revisión</h1>
      <p className="mt-1 text-xs text-slate">
        Cada resolución actualiza el diccionario o el maestro — se aplica retroactivamente a todo el histórico en la
        próxima corrida (R3).
      </p>

      <div className="mt-3 rounded-md border border-gold/60 bg-gold/10 px-4 py-2 text-xs text-ink">
        <strong>Vista previa — la persistencia llega en Sprint 5.</strong> Las resoluciones de esta pantalla solo
        actualizan el estado local del navegador; todavía no se guardan en el diccionario ni el maestro.
      </div>

      {toast ? (
        <div role="status" className="mt-3 rounded-md bg-navy px-4 py-2 text-xs font-semibold text-white">
          {toast}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {cola.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge label={TIPO_LABEL[item.tipo]} variant={TIPO_VARIANT[item.tipo]} />
              <span className="font-mono text-sm font-semibold text-navy">{item.valorCrudo}</span>
              <span className="ml-auto font-mono text-xs text-slate">
                {fmt.format(item.registrosAfectados)} registros
              </span>
              <span className="font-mono text-xs font-semibold text-ink">{fmt1.format(item.tonAfectadas)} TON</span>
            </div>

            {item.sugerenciaFuzzy ? (
              <div className="mt-2 inline-flex items-center gap-1 rounded bg-green/10 px-2 py-1 font-mono text-xs text-green">
                → {item.sugerenciaFuzzy.segmentoN3} ({item.sugerenciaFuzzy.score})
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-2">sin sugerencia fuzzy</div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={drafts[item.id] ?? item.resolucion ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                placeholder="Resolución (segmento canónico o nota)…"
                className="w-full max-w-md rounded border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-navy"
              />
              <button
                type="button"
                onClick={() => handleResolve(item.valorCrudo)}
                className="whitespace-nowrap rounded bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-deep"
              >
                Resolver (local)
              </button>
            </div>
          </Card>
        ))}

        {cola.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate">No hay elementos en la cola de revisión.</Card>
        ) : null}
      </div>
    </div>
  )
}
