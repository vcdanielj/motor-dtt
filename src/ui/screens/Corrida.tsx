import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'
import DropZone from '@/ui/components/DropZone'
import StageBar from '@/ui/components/StageBar'

const fmt = new Intl.NumberFormat('es-VE')

// Renders a fraction-of-100 as an es-VE percentage string ("92,4%") — comma decimal.
const pctEs = (n: number) => `${n}`.replace('.', ',') + '%'

export default function Corrida() {
  const ingest = useStore((s) => s.ingest)
  const runResult = useStore((s) => s.runResult)
  const exportState = useStore((s) => s.exportState)
  const exportBase = useStore((s) => s.exportBase)
  const exportUnclassifiedTemplate = useStore((s) => s.exportUnclassifiedTemplate)

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
                {runResult ? (
                  <>
                    {fmt.format(ingest.summary.totalRows)} filas · clasificación {pctEs(runResult.clasificacionPct)} ·
                    estado válido {pctEs(runResult.estadoValidoPct)}
                  </>
                ) : (
                  <>
                    {fmt.format(ingest.summary.totalRows)} filas · {fmt.format(ingest.summary.distributors)} distribuidores ·{' '}
                    {fmt.format(ingest.summary.durationMs)} ms
                  </>
                )}
              </span>
            </div>
            <StageBar />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void exportBase()}
                disabled={!runResult || exportState === 'running'}
                className="rounded-md bg-navy px-4 py-2 text-xs font-semibold text-panel transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportState === 'running' ? 'Generando…' : 'Descargar base estandarizada'}
              </button>
              {runResult && runResult.clientesSinClasificar && runResult.clientesSinClasificar.length > 0 && (
                <button
                  type="button"
                  onClick={() => void exportUnclassifiedTemplate()}
                  disabled={exportState === 'running'}
                  className="rounded-md border border-line bg-white text-navy px-4 py-2 text-xs font-semibold hover:bg-line/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Descargar plantilla sin clasificar ({runResult.clientesSinClasificar.length})
                </button>
              )}
              {exportState === 'running' && (
                <div
                  className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-navy"
                  aria-hidden="true"
                />
              )}
              {exportState === 'done' && (
                <span className="text-xs font-semibold text-green">Descarga lista</span>
              )}
              {exportState === 'error' && (
                <span className="text-xs font-semibold text-red">No se pudo exportar</span>
              )}
            </div>
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
