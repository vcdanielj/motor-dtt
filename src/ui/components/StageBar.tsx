import { useStore } from '@/state/store'

const fmt = new Intl.NumberFormat('es-VE')

type StageStatus = 'pendiente' | 'en curso' | 'completado' | 'error'

const STATUS_CLASSES: Record<StageStatus, string> = {
  pendiente: 'bg-line text-slate',
  'en curso': 'bg-cyan text-white',
  completado: 'bg-green text-white',
  error: 'bg-red text-white',
}

export default function StageBar() {
  const stages = useStore((s) => s.stages)
  const ingest = useStore((s) => s.ingest)

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line bg-panel">
      {stages.map((label, i) => {
        // Sprint 1: only the first stage (Ingesta) reflects the real worker.
        // The other five are not wired yet — showing them as "pendiente" is honest.
        const isIngesta = i === 0
        let status: StageStatus = 'pendiente'
        let detail = 'pendiente'

        if (isIngesta) {
          if (ingest.phase === 'running') {
            status = 'en curso'
            detail = 'Leyendo archivo…'
          } else if (ingest.phase === 'done' && ingest.summary) {
            status = 'completado'
            detail = `${fmt.format(ingest.summary.totalRows)} filas · ${fmt.format(ingest.summary.distributors)} distribuidores`
          } else if (ingest.phase === 'error') {
            status = 'error'
            detail = 'error'
          }
        }

        return (
          <div key={label} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
            <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-bg text-xs font-bold text-navy">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-navy">{label}</div>
              <div className="mt-0.5 font-mono text-[11px] text-slate">{detail}</div>
            </div>
            <div className={`flex-none rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}>
              {status}
            </div>
          </div>
        )
      })}
    </div>
  )
}
