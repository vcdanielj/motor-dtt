import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'
import DropZone from '@/ui/components/DropZone'
import StageBar from '@/ui/components/StageBar'

const fmt = new Intl.NumberFormat('es-VE')

export default function Corrida() {
  const ingest = useStore((s) => s.ingest)

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Corrida · Ingesta de archivo</h1>
      <p className="mt-1 text-xs text-slate">
        Carga un archivo CSV o XLSX consolidado para iniciar el pipeline de estandarización.
      </p>

      <Card className="mt-5">
        {ingest.phase === 'idle' && <DropZone />}

        {ingest.phase === 'running' && (
          <div>
            <div className="flex items-center gap-3">
              <div
                className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-navy"
                aria-hidden="true"
              />
              <div className="font-mono text-xs text-ink">
                {ingest.fileName} · {fmt.format(ingest.rows)} filas · {fmt.format(ingest.distributors)} distribuidores
              </div>
            </div>
            <StageBar />
          </div>
        )}

        {ingest.phase === 'done' && ingest.summary && (
          <div>
            <div className="rounded-md border border-green bg-bg px-4 py-3 text-sm font-semibold text-green">
              <span className="font-mono">
                {fmt.format(ingest.summary.totalRows)} filas · {fmt.format(ingest.summary.distributors)} distribuidores ·{' '}
                {fmt.format(ingest.summary.durationMs)} ms
              </span>
            </div>
            <StageBar />
          </div>
        )}

        {ingest.phase === 'error' && (
          <div className="rounded-md border border-red bg-red/10 px-4 py-3 text-sm font-semibold text-red">
            {ingest.error}
          </div>
        )}
      </Card>
    </div>
  )
}
