import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'
import Table, { type TableColumn } from '@/ui/components/Table'

type DistribuidorRow = ReturnType<typeof useStore.getState>['distribuidores'][number]

type SortKey = 'nombre' | 'scdcCrudo' | 'scdcPost' | 'registros' | 'ton'
type SortDir = 'asc' | 'desc'

const fmt = new Intl.NumberFormat('es-VE')
const fmt1 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function ScdcBar({ value, tint }: { value: number; tint: 'red' | 'green' }) {
  const barColor = tint === 'red' ? 'bg-red/25' : 'bg-green/25'
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="relative h-3 w-16 overflow-hidden rounded bg-line/60">
        <div className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold text-ink">{value}</span>
    </div>
  )
}

export default function Distribuidores() {
  const distribuidores = useStore((s) => s.distribuidores)
  const [sortKey, setSortKey] = useState<SortKey>('scdcCrudo')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: string) => {
    const k = key as SortKey
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const rows = [...distribuidores]
    rows.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [distribuidores, sortKey, sortDir])

  const columns: TableColumn<DistribuidorRow>[] = [
    { key: 'nombre', header: 'Distribuidor', sortable: true, render: (d) => <span className="font-semibold text-ink">{d.nombre}</span> },
    {
      key: 'scdcCrudo',
      header: 'SCDC crudo',
      align: 'right',
      sortable: true,
      render: (d) => <ScdcBar value={d.scdcCrudo} tint="red" />,
    },
    {
      key: 'scdcPost',
      header: 'SCDC post-motor',
      align: 'right',
      sortable: true,
      render: (d) => <ScdcBar value={d.scdcPost} tint="green" />,
    },
    {
      key: 'registros',
      header: 'Registros',
      align: 'right',
      sortable: true,
      render: (d) => <span className="font-mono text-xs text-slate">{fmt.format(d.registros)}</span>,
    },
    {
      key: 'ton',
      header: 'TON',
      align: 'right',
      sortable: true,
      render: (d) => <span className="font-mono text-xs font-semibold text-ink">{fmt1.format(d.ton)}</span>,
    },
  ]

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Distribuidores · Ranking SCDC</h1>
      <p className="mt-1 text-xs text-slate">
        SCDC calculado sobre el crudo (D5) — no refleja rescates del motor. La columna post-motor se muestra solo como
        referencia informativa.
      </p>

      <Card className="mt-5 overflow-x-auto">
        <Table
          columns={columns}
          rows={sorted}
          rowKey={(d) => d.id}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </Card>
    </div>
  )
}
