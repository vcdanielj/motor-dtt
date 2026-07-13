import { useStore } from '@/state/store'
import Card from '@/ui/components/Card'
import Metric from '@/ui/components/Metric'
import Sparkline from '@/ui/components/Sparkline'

function sparkColor(scdcPost: number): string {
  if (scdcPost < 50) return '#C8102E'
  if (scdcPost < 80) return '#E87722'
  return '#1E8E3E'
}

export default function Dashboard() {
  const dashboard = useStore((s) => s.dashboard)
  const distribuidores = useStore((s) => s.distribuidores)

  return (
    <div className="max-w-[1240px]">
      <h1 className="text-lg font-bold text-navy">Dashboard · Última corrida</h1>
      <p className="mt-1 text-xs text-slate">Resumen de la corrida más reciente sobre el histórico cargado.</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Metric label="Registros procesados" value={dashboard.totalFilas} />
        </Card>
        <Card>
          <Metric label="Macro-canal N1 resuelto" value={dashboard.clasificacionN3} />
        </Card>
        <Card>
          <Metric label="Segmento N3 exacto" value={dashboard.coberturaN3} />
        </Card>
        <Card>
          <Metric label="Estado válido" value={dashboard.estadoValido} />
        </Card>
      </div>

      <Card className="mt-3">
        <div className="text-xs font-bold uppercase tracking-wider text-navy">SCDC por distribuidor · crudo → post-motor</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {distribuidores.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
              <div>
                <div className="text-xs font-semibold text-ink">{d.nombre}</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate">
                  {d.scdcCrudo} → {d.scdcPost}
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
