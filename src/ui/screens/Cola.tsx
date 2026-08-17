import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'
import Badge from '@/ui/components/Badge'
import type { SegmentoSeed } from '@/contracts/config'
import type { ColaDominio, ColaTipo } from '@/contracts/cola'

const fmt = new Intl.NumberFormat('es-VE')
const fmt1 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const TIPO_LABEL: Record<ColaTipo, string> = {
  VARIANTE_NUEVA: 'Variante nueva',
  CONFLICTO_MAYOR: 'Conflicto mayor',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'Alto volumen',
  ESTADO_VARIANTE_NUEVA: 'Estado · Variante nueva',
  ESTADO_SIN_RESOLVER: 'Estado · Sin resolver',
  CIUDAD_SIN_MAPEAR: 'Ciudad sin mapear',
}

const TIPO_VARIANT: Record<ColaTipo, 'green' | 'red' | 'amber'> = {
  VARIANTE_NUEVA: 'amber',
  CONFLICTO_MAYOR: 'red',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'amber',
  ESTADO_VARIANTE_NUEVA: 'amber',
  ESTADO_SIN_RESOLVER: 'amber',
  CIUDAD_SIN_MAPEAR: 'green',
}

// CONFLICTO_MAYOR carries a RIF in valorCrudo (resolved into the maestro); the segmento tipos
// carry a raw segment string and the estado tipos a raw state string (each resolved into its own
// diccionario) — the copy reflects which one applies.
const TIPO_PROMPT: Record<ColaTipo, string> = {
  VARIANTE_NUEVA: 'Mapear esta variante a un segmento',
  CONFLICTO_MAYOR: 'Asignar segmento definitivo al cliente (RIF)',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'Mapear esta variante a un segmento',
  ESTADO_VARIANTE_NUEVA: 'Mapear esta variante a un estado',
  ESTADO_SIN_RESOLVER: 'Mapear esta variante a un estado',
  CIUDAD_SIN_MAPEAR: '¿En qué estado queda esta ciudad?',
}

const DOMINIO_LABEL: Record<ColaDominio, string> = {
  SEGMENTO: 'Segmento',
  ESTADO: 'Estado',
}

// Groups the 37 N3 by macroN1, preserving first-seen order, for the <optgroup> select below.
function groupByMacro(segmentos: SegmentoSeed[]): Array<{ macro: string; items: SegmentoSeed[] }> {
  const order: string[] = []
  const byMacro = new Map<string, SegmentoSeed[]>()
  for (const s of segmentos) {
    if (!byMacro.has(s.macroN1)) {
      byMacro.set(s.macroN1, [])
      order.push(s.macroN1)
    }
    byMacro.get(s.macroN1)!.push(s)
  }
  return order.map((macro) => ({ macro, items: byMacro.get(macro)! }))
}

type Filtro = 'TODOS' | ColaDominio

export default function Cola() {
  const cola = useStore((s) => s.cola)
  const segmentos = useStore((s) => s.seeds.segmentos)
  const estados = useStore((s) => s.seeds.estados)
  const resolveColaItem = useStore((s) => s.resolveColaItem)
  const setView = useStore((s) => s.setView)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')

  const groups = useMemo(() => groupByMacro(segmentos), [segmentos])
  const conteos = useMemo(
    () => ({
      TODOS: cola.length,
      SEGMENTO: cola.filter((c) => c.dominio === 'SEGMENTO').length,
      ESTADO: cola.filter((c) => c.dominio === 'ESTADO').length,
    }),
    [cola],
  )
  const visibles = useMemo(
    () => (filtro === 'TODOS' ? cola : cola.filter((c) => c.dominio === filtro)),
    [cola, filtro],
  )

  const handleSave = async (itemId: string, valorCrudo: string, chosen: string) => {
    setSaving((s) => ({ ...s, [itemId]: true }))
    try {
      await resolveColaItem(itemId, chosen)
      setToast(`«${valorCrudo}» → ${chosen} · guardado; se aplicará en la próxima corrida.`)
      window.setTimeout(() => setToast(null), 3600)
    } finally {
      setSaving((s) => ({ ...s, [itemId]: false }))
    }
  }

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Cola de revisión</h1>
      <p className="mt-1 text-xs text-slate">
        Cada resolución actualiza el diccionario de segmentos, el de estados o el maestro — se aplica retroactivamente a
        todo el histórico en la próxima corrida (R3).
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {(['TODOS', 'SEGMENTO', 'ESTADO'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filtro === f ? 'bg-navy text-panel' : 'text-slate hover:bg-bg'
            }`}
          >
            {f === 'TODOS' ? 'Todos' : DOMINIO_LABEL[f]} ({conteos[f]})
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-green/60 bg-green/10 px-4 py-2 text-xs text-ink flex flex-wrap items-center justify-between gap-2">
        <span>
          Las clasificaciones se guardan localmente y se aplican en la próxima corrida. Se guardan en este navegador
          (IndexedDB) — no se sincronizan a ningún servidor ni a otros equipos.
        </span>
        <button
          type="button"
          onClick={() => setView('config')}
          className="text-xs font-bold text-navy hover:underline ml-auto"
        >
          Ver reglas en Configuración →
        </button>
      </div>

      {toast ? (
        <div role="status" className="mt-3 rounded-md bg-navy px-4 py-2 text-xs font-semibold text-white">
          {toast}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {visibles.map((item) => {
          const chosen = selections[item.id] ?? ''
          const isResolved = item.resolucion !== null
          const isSaving = saving[item.id] === true
          const esEstado = item.dominio === 'ESTADO'

          return (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge label={TIPO_LABEL[item.tipo]} variant={TIPO_VARIANT[item.tipo]} />
                <span className="font-mono text-sm font-semibold text-navy">{item.valorCrudo}</span>
                <span className="ml-auto font-mono text-xs text-slate">
                  {fmt.format(item.registrosAfectados)} registros
                </span>
                <span className="font-mono text-xs font-semibold text-ink">{fmt1.format(item.tonAfectadas)} TON</span>
              </div>

              {isResolved ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded bg-green/10 px-3 py-2 text-xs font-semibold text-green">
                  <span aria-hidden="true">✓</span>
                  Resuelto → {item.resolucion}
                </div>
              ) : (
                <>
                  <div className="mt-2 text-xs font-semibold text-navy">{TIPO_PROMPT[item.tipo]}</div>

                  {item.sugerenciaFuzzy ? (
                    <button
                      type="button"
                      onClick={() => setSelections((s) => ({ ...s, [item.id]: item.sugerenciaFuzzy!.valor }))}
                      className="mt-2 inline-flex items-center gap-1 rounded bg-green/10 px-2 py-1 font-mono text-xs text-green hover:bg-green/20"
                    >
                      Usar sugerencia: {item.sugerenciaFuzzy.valor} ({item.sugerenciaFuzzy.score})
                    </button>
                  ) : (
                    <div className="mt-2 text-xs text-slate-2">sin sugerencia fuzzy</div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Clasificar como… (${item.valorCrudo})`}
                      value={chosen}
                      onChange={(e) => setSelections((s) => ({ ...s, [item.id]: e.target.value }))}
                      className="w-full max-w-md rounded border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-navy"
                    >
                      <option value="">Clasificar como…</option>
                      {esEstado
                        ? estados.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))
                        : groups.map((g) => (
                            <optgroup key={g.macro} label={g.macro}>
                              {g.items.map((seg) => (
                                <option key={seg.n3} value={seg.n3}>
                                  {seg.n3}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                    </select>
                    <button
                      type="button"
                      disabled={!chosen || isSaving}
                      onClick={() => handleSave(item.id, item.valorCrudo, chosen)}
                      className="whitespace-nowrap rounded bg-navy px-3 py-1.5 text-xs font-semibold text-panel hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Guardar clasificación
                    </button>
                  </div>
                </>
              )}
            </Card>
          )
        })}

        {visibles.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate">
            {cola.length === 0
              ? 'No hay elementos en la cola de revisión.'
              : `No hay elementos de ${DOMINIO_LABEL[filtro as ColaDominio].toLowerCase()} en la cola.`}
          </Card>
        ) : null}
      </div>
    </div>
  )
}
