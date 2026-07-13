import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import type { MaestroEntry } from '@/contracts/maestro'
import type { MetodoSegmento } from '@/contracts/row'
import Badge, { type BadgeVariant } from '@/ui/components/Badge'
import Card from '@/ui/components/Card'
import Table, { type TableColumn } from '@/ui/components/Table'

const METODO_LABEL: Record<NonNullable<MetodoSegmento>, string> = {
  MAESTRO: 'Maestro',
  EXACTO: 'Exacto',
  FUZZY: 'Fuzzy',
  MANUAL: 'Manual',
}

const METODO_VARIANT: Record<NonNullable<MetodoSegmento>, BadgeVariant> = {
  MAESTRO: 'navy',
  EXACTO: 'green',
  FUZZY: 'amber',
  MANUAL: 'gold',
}

const dash = (value: string | null) => value ?? '—'

export default function Maestro() {
  const maestro = useStore((s) => s.maestro)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return maestro
    return maestro.filter(
      (m) => m.rif.toLowerCase().includes(q) || (m.razonSocial ?? '').toLowerCase().includes(q),
    )
  }, [maestro, query])

  const columns: TableColumn<MaestroEntry>[] = [
    { key: 'rif', header: 'RIF', render: (m) => <span className="font-mono text-xs font-semibold text-navy">{m.rif}</span> },
    { key: 'razonSocial', header: 'Cliente', render: (m) => <span className="font-semibold text-ink">{dash(m.razonSocial)}</span> },
    { key: 'segmentoN3', header: 'Segmento N3', render: (m) => dash(m.segmentoN3) },
    { key: 'macroN1', header: 'Macro-canal N1', render: (m) => <span className="text-xs text-slate">{dash(m.macroN1)}</span> },
    {
      key: 'metodo',
      header: 'Método',
      render: (m) => (m.metodo ? <Badge label={METODO_LABEL[m.metodo]} variant={METODO_VARIANT[m.metodo]} /> : <span className="text-xs text-slate">—</span>),
    },
    {
      key: 'confianza',
      header: 'Confianza',
      render: (m) => <span className="font-mono text-xs text-slate">{dash(m.confianza)}</span>,
    },
    { key: 'estadoHabitual', header: 'Estado habitual', render: (m) => <span className="text-xs text-slate">{dash(m.estadoHabitual)}</span> },
    { key: 'reglaCanonica', header: 'Regla canónica', render: (m) => <span className="text-xs text-slate">{dash(m.reglaCanonica)}</span> },
  ]

  return (
    <div className="max-w-[1240px]">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy">Maestro de clientes</h1>
          <p className="mt-1 text-xs text-slate">El segmento es propiedad del cliente, no de la transacción.</p>
        </div>
        <div className="text-[11.5px] text-slate">
          Precedencia: <strong className="text-navy">Manual &gt; Más reciente &gt; Moda</strong> (D3)
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por RIF o nombre de cliente…"
        className="mt-4 w-full max-w-[420px] rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
      />
      <span className="ml-3 text-[11.5px] text-slate">{filtered.length} de {maestro.length} clientes</span>

      <Card className="mt-3 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate">Sin resultados para esta búsqueda.</div>
        ) : (
          <Table columns={columns} rows={filtered} rowKey={(m) => m.rif} />
        )}
      </Card>
    </div>
  )
}
