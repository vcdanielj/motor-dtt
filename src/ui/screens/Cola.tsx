import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import type { ColaTipo } from '@/contracts/cola'
import type { SegmentoSeed } from '@/contracts/config'
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

// CONFLICTO_MAYOR carries a RIF in valorCrudo (resolved into the maestro); the other tipos carry
// a raw segment string (resolved into the diccionario) — the copy reflects which one applies.
const TIPO_PROMPT: Record<ColaTipo, string> = {
  VARIANTE_NUEVA: 'Mapear esta variante a un segmento',
  CONFLICTO_MAYOR: 'Asignar segmento definitivo al cliente (RIF)',
  ALTO_VOLUMEN_SIN_CLASIFICAR: 'Mapear esta variante a un segmento',
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

export default function Cola() {
  const cola = useStore((s) => s.cola)
  const segmentos = useStore((s) => s.seeds.segmentos)
  const resolveColaItem = useStore((s) => s.resolveColaItem)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)

  const groups = useMemo(() => groupByMacro(segmentos), [segmentos])

  const handleSave = async (itemId: string, valorCrudo: string, chosenN3: string) => {
    setSaving((s) => ({ ...s, [itemId]: true }))
    try {
      await resolveColaItem(itemId, chosenN3)
      setToast(`«${valorCrudo}» → ${chosenN3} · guardado; se aplicará en la próxima corrida.`)
      window.setTimeout(() => setToast(null), 3600)
    } finally {
      setSaving((s) => ({ ...s, [itemId]: false }))
    }
  }

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Cola de revisión</h1>
      <p className="mt-1 text-xs text-slate">
        Cada resolución actualiza el diccionario o el maestro — se aplica retroactivamente a todo el histórico en la
        próxima corrida (R3).
      </p>

      <div className="mt-3 rounded-md border border-green/60 bg-green/10 px-4 py-2 text-xs text-ink">
        Las clasificaciones se guardan localmente y se aplican en la próxima corrida. Se guardan en este navegador
        (IndexedDB) — no se sincronizan a ningún servidor ni a otros equipos.
      </div>

      {toast ? (
        <div role="status" className="mt-3 rounded-md bg-navy px-4 py-2 text-xs font-semibold text-white">
          {toast}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {cola.map((item) => {
          const chosen = selections[item.id] ?? ''
          const isResolved = item.resolucion !== null
          const isSaving = saving[item.id] === true

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
                      onClick={() => setSelections((s) => ({ ...s, [item.id]: item.sugerenciaFuzzy!.segmentoN3 }))}
                      className="mt-2 inline-flex items-center gap-1 rounded bg-green/10 px-2 py-1 font-mono text-xs text-green hover:bg-green/20"
                    >
                      Usar sugerencia: {item.sugerenciaFuzzy.segmentoN3} ({item.sugerenciaFuzzy.score})
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
                      {groups.map((g) => (
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

        {cola.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate">No hay elementos en la cola de revisión.</Card>
        ) : null}
      </div>
    </div>
  )
}
