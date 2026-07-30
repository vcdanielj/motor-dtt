import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'
import Metric from '@/ui/components/Metric'
import Sparkline from '@/ui/components/Sparkline'

function sparkColor(scdcPost: number): string {
  if (scdcPost < 50) return '#8A1538' // Heinz Burgundy
  if (scdcPost < 80) return '#E87722' // Amber
  return '#1E8E3E' // Green
}

export default function Dashboard() {
  const distribuidores = useStore((s) => s.distribuidores)
  const runResult = useStore((s) => s.runResult)
  const setView = useStore((s) => s.setView)

  const handlePrint = () => {
    window.print()
  }

  // Calculate stats in real-time if a run occurred, otherwise fallback to mock values
  const hasRun = !!runResult
  const totalFilas = hasRun ? (runResult.summary.totalRows ?? 0) : 740009
  const clasificacionN3 = hasRun ? runResult.clasificacionPct : 88.3
  const coberturaN3 = hasRun ? runResult.clasificacionCrudoPct : 92.4
  const estadoValido = hasRun ? runResult.estadoValidoPct : 94.1

  const fileName = hasRun ? runResult.summary.fileName : 'Sell out OCT-25 MAR-26.csv'
  const durationMs = hasRun ? runResult.summary.durationMs : 4820
  const tonTotal = hasRun ? runResult.tonTotal : 12450.8
  const tonSinClasificar = hasRun ? runResult.tonSinClasificar : 1456.2

  const exactoCount = hasRun ? (runResult.segmento.EXACTO + runResult.segmento.FUZZY) : 623456
  const maestroCount = hasRun ? runResult.segmento.MAESTRO : 30203
  const sinClasificarCount = hasRun ? runResult.segmento.SIN_CLASIFICAR : 86350

  const totalSegmentoCount = exactoCount + maestroCount + sinClasificarCount
  const exactoPct = Math.round((exactoCount / totalSegmentoCount) * 100)
  const maestroPct = Math.round((maestroCount / totalSegmentoCount) * 100)
  const sinClasificarPct = 100 - exactoPct - maestroPct

  const activeDists = hasRun ? runResult.distribuidores : distribuidores
  const avgCrudo = Math.round(activeDists.reduce((acc, d) => acc + d.scdcCrudo, 0) / (activeDists.length || 1))
  const avgPost = Math.round(activeDists.reduce((acc, d) => acc + d.scdcPost, 0) / (activeDists.length || 1))
  const scdcGain = avgPost - avgCrudo

  // Estado resolution mix, mirroring the segment split above. Grouped into the three buckets that
  // matter to the analyst: what the distributor already sent usable, what the motor recovered, and
  // what is still pending.
  const estadoMix = hasRun
    ? {
        crudo: runResult.estado.EXACTO,
        recuperado: runResult.estado.DICCIONARIO + runResult.estado.RIF + runResult.estado.CIUDAD + runResult.estado.FUZZY,
        pendiente: runResult.estado.SIN_ESTADO,
      }
    : { crudo: 610240, recuperado: 85320, pendiente: 44449 }
  const totalEstadoCount = estadoMix.crudo + estadoMix.recuperado + estadoMix.pendiente || 1
  const estadoCrudoPct = Math.round((estadoMix.crudo / totalEstadoCount) * 100)
  const estadoRecuperadoPct = Math.round((estadoMix.recuperado / totalEstadoCount) * 100)
  const estadoPendientePct = 100 - estadoCrudoPct - estadoRecuperadoPct

  const clientesPendientes = hasRun ? runResult.clientesSinClasificar : []
  const clientesSinClasificarCount = hasRun ? clientesPendientes.length : 124
  const faltaSoloEstado = clientesPendientes.filter((c) => c.faltaEstado && !c.faltaSegmento).length

  return (
    <div className="max-w-[1240px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-lg font-bold text-navy">Dashboard · Última corrida</h1>
          <p className="mt-1 text-xs text-slate">Resumen de la corrida más reciente sobre el histórico cargado.</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="no-print rounded-md bg-navy px-4 py-2 text-xs font-semibold text-panel transition-opacity hover:opacity-90 flex items-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Generar reporte PDF
        </button>
      </div>

      {/* Metadata Card (run info) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate">Archivo cargado</div>
          <div className="mt-1 text-xs font-semibold text-navy truncate" title={fileName}>{fileName}</div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate">Duración del pipeline</div>
          <div className="mt-1 text-xs font-semibold text-navy">{(durationMs / 1000).toFixed(2)} segundos</div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate">Volumen total</div>
          <div className="mt-1 text-xs font-semibold text-navy">
            {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 }).format(tonTotal)} TON
          </div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate">Volumen sin clasificar</div>
          <div className="mt-1 text-xs font-semibold text-navy">
            {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 }).format(tonSinClasificar)} TON ({Math.round(tonSinClasificar / (tonTotal || 1) * 100)}%)
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Metric label="Registros procesados" value={totalFilas.toLocaleString('es-VE')} />
        </Card>
        <Card>
          <Metric label="Clasificación N3" value={`${clasificacionN3}%`.replace('.', ',')} />
        </Card>
        <Card>
          <Metric label="Cobertura N3" value={`${coberturaN3}%`.replace('.', ',')} />
        </Card>
        <Card>
          <Metric label="Estado válido" value={`${estadoValido}%`.replace('.', ',')} />
        </Card>
      </div>

      {/* Global Segment Resolution Distribution */}
      <Card className="mt-3">
        <div className="text-xs font-bold uppercase tracking-wider text-navy">Distribución de Resolución de Segmentos</div>
        <div className="mt-3 flex h-6 overflow-hidden rounded-full bg-slate/10 font-mono text-[10px] text-white font-bold">
          <div
            className="flex items-center justify-center bg-navy"
            style={{ width: `${exactoPct}%` }}
            title={`Exacto/Fuzzy: ${exactoCount.toLocaleString('es-VE')} filas`}
          >
            {exactoPct > 10 && `EXACTO/FUZZY ${exactoPct}%`}
          </div>
          <div
            className="flex items-center justify-center bg-red"
            style={{ width: `${maestroPct}%` }}
            title={`Maestro/Historial: ${maestroCount.toLocaleString('es-VE')} filas`}
          >
            {maestroPct > 10 && `HISTORIAL ${maestroPct}%`}
          </div>
          <div
            className="flex items-center justify-center bg-slate text-slate-2"
            style={{ width: `${sinClasificarPct}%` }}
            title={`Sin clasificar: ${sinClasificarCount.toLocaleString('es-VE')} filas`}
          >
            {sinClasificarPct > 10 && `PENDIENTE ${sinClasificarPct}%`}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-navy">
            <span className="h-3 w-3 rounded bg-navy inline-block" />
            <span>Resolución Directa (Exacto/Fuzzy): <strong>{exactoCount.toLocaleString('es-VE')}</strong> ({exactoPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-red">
            <span className="h-3 w-3 rounded bg-red inline-block" />
            <span>Recuperación Histórica por RIF: <strong>{maestroCount.toLocaleString('es-VE')}</strong> ({maestroPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate">
            <span className="h-3 w-3 rounded bg-slate inline-block" />
            <span>Sin Clasificar (Pendientes): <strong>{sinClasificarCount.toLocaleString('es-VE')}</strong> ({sinClasificarPct}%)</span>
          </div>
        </div>
      </Card>

      {/* Global Estado Resolution Distribution — the estado twin of the segment split above. */}
      <Card className="mt-3">
        <div className="text-xs font-bold uppercase tracking-wider text-navy">Distribución de Resolución de Estados</div>
        <div className="mt-3 flex h-6 overflow-hidden rounded-full bg-slate/10 font-mono text-[10px] text-white font-bold">
          <div
            className="flex items-center justify-center bg-navy"
            style={{ width: `${estadoCrudoPct}%` }}
            title={`Ya canónico en el archivo: ${estadoMix.crudo.toLocaleString('es-VE')} filas`}
          >
            {estadoCrudoPct > 10 && `CANÓNICO ${estadoCrudoPct}%`}
          </div>
          <div
            className="flex items-center justify-center bg-red"
            style={{ width: `${estadoRecuperadoPct}%` }}
            title={`Recuperado por diccionario, RIF, ciudad o fuzzy: ${estadoMix.recuperado.toLocaleString('es-VE')} filas`}
          >
            {estadoRecuperadoPct > 10 && `RECUPERADO ${estadoRecuperadoPct}%`}
          </div>
          <div
            className="flex items-center justify-center bg-slate text-slate-2"
            style={{ width: `${estadoPendientePct}%` }}
            title={`Sin estado: ${estadoMix.pendiente.toLocaleString('es-VE')} filas`}
          >
            {estadoPendientePct > 10 && `PENDIENTE ${estadoPendientePct}%`}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-navy">
            <span className="h-3 w-3 rounded bg-navy inline-block" />
            <span>Enviado ya canónico: <strong>{estadoMix.crudo.toLocaleString('es-VE')}</strong> ({estadoCrudoPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-red">
            <span className="h-3 w-3 rounded bg-red inline-block" />
            <span>Recuperado por el motor: <strong>{estadoMix.recuperado.toLocaleString('es-VE')}</strong> ({estadoRecuperadoPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate">
            <span className="h-3 w-3 rounded bg-slate inline-block" />
            <span>Sin estado (pendientes): <strong>{estadoMix.pendiente.toLocaleString('es-VE')}</strong> ({estadoPendientePct}%)</span>
          </div>
        </div>
        {hasRun && runResult.recuperadosEstado > 0 ? (
          <p className="mt-2 text-[11px] text-slate">
            Incluye <strong>{runResult.recuperadosEstado.toLocaleString('es-VE')}</strong> filas cuyo estado se
            recuperó por RIF a partir del estado habitual del cliente en el maestro.
          </p>
        ) : null}
      </Card>

      {/* SCDC Gain Info Card */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-panel p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-navy">SCDC Promedio Crudo</div>
            <div className="mt-2 text-3xl font-black text-navy">{avgCrudo}%</div>
          </div>
          <p className="mt-2 text-[11px] text-slate leading-relaxed">Exactitud promedio antes del pipeline.</p>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red">SCDC Promedio Post-Motor</div>
            <div className="mt-2 text-3xl font-black text-red">{avgPost}%</div>
          </div>
          <p className="mt-2 text-[11px] text-slate leading-relaxed">Exactitud promedio lograda por el motor.</p>
        </div>
        <div className="rounded-lg border border-green bg-green/5 p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-green">Incremento Promedio SCDC</div>
            <div className="mt-2 text-3xl font-black text-green">+{scdcGain}%</div>
          </div>
          <p className="mt-2 text-[11px] text-slate leading-relaxed">Ganancia total de exactitud y cobertura de datos.</p>
        </div>
      </div>

      {/* Unclassified Warning Callout */}
      {clientesSinClasificarCount > 0 && (
        <div className="mt-3 rounded-lg border border-red/20 bg-red/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-red">Acción requerida: Clientes Incompletos</h4>
            <p className="mt-1 text-xs text-slate">
              La corrida identificó <strong>{clientesSinClasificarCount}</strong> clientes (RIFs) a los que les falta
              el segmento, el estado o ambos
              {faltaSoloEstado > 0 ? <> — <strong>{faltaSoloEstado}</strong> solo por el estado</> : null}.
              Descarga las plantillas por distribuidor para su corrección.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView('corrida')}
            className="no-print rounded border border-red/40 bg-white px-3 py-1.5 text-xs font-bold text-red hover:bg-red/10 whitespace-nowrap self-start sm:self-center"
          >
            Ir a descargas
          </button>
        </div>
      )}

      {/* Distributors Breakdown */}
      <Card className="mt-3">
        <div className="text-xs font-bold uppercase tracking-wider text-navy">SCDC por distribuidor · crudo → post-motor</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {activeDists.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink truncate" title={d.nombre}>{d.nombre}</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate">
                  {d.scdcCrudo}% → {d.scdcPost}%
                </div>
              </div>
              <Sparkline values={[d.scdcCrudo, d.scdcPost]} stroke={sparkColor(d.scdcPost)} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
