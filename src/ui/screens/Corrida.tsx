import { useState } from 'react'
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
  const exportUnclassifiedZip = useStore((s) => s.exportUnclassifiedZip)
  const importClientesTemplate = useStore((s) => s.importClientesTemplate)
  const lastFile = useStore((s) => s.lastFile)
  const startPipeline = useStore((s) => s.startPipeline)

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  const handleImportClientesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const { added, skipped } = await importClientesTemplate(file)
      setImportResult(`${added} clientes importados · ${skipped} omitidos`)
    } catch (err) {
      setImportResult((err as Error).message || 'Error al importar plantilla')
    } finally {
      setImporting(false)
    }
  }

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
                <>
                  <button
                    type="button"
                    onClick={() => void exportUnclassifiedTemplate()}
                    disabled={exportState === 'running'}
                    className="rounded-md border border-line bg-white text-navy px-4 py-2 text-xs font-semibold hover:bg-line/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Descargar plantilla consolidada ({runResult.clientesSinClasificar.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportUnclassifiedZip()}
                    disabled={exportState === 'running'}
                    className="rounded-md border border-line bg-white text-navy px-4 py-2 text-xs font-semibold hover:bg-line/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Descargar plantillas por distribuidor (ZIP)
                  </button>
                  <span className="text-[11px] text-slate">
                    Piden segmento y estado, con desplegables validados contra los catálogos oficiales.
                  </span>
                </>
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

            {/* Template Carga Box */}
            <div className="mt-6 border-t border-line/60 pt-5">
              <div className="text-xs font-bold uppercase tracking-wider text-navy mb-1.5">Cargar plantilla completada</div>
              <p className="text-xs text-slate mb-3">
                Sube la plantilla (.xlsx o .csv) que rellenaron tus distribuidores para integrar las nuevas clasificaciones al sistema.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-red px-3 py-1.5 text-xs font-semibold text-panel transition-opacity hover:opacity-90">
                  {importing ? 'Importando…' : 'Seleccionar plantilla resuelta'}
                  <input
                    type="file"
                    accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    disabled={importing}
                    onChange={(e) => void handleImportClientesChange(e)}
                  />
                </label>
                {importResult && (
                  <span className="text-xs font-semibold text-green bg-green/10 border border-green/20 px-2.5 py-1 rounded">
                    {importResult}
                  </span>
                )}
                {importResult && lastFile && (
                  <button
                    type="button"
                    onClick={() => void startPipeline(lastFile)}
                    className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-panel hover:opacity-90 transition-opacity"
                  >
                    Re-procesar archivo crudo ({lastFile.name})
                  </button>
                )}
              </div>
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
