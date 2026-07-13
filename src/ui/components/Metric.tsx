interface MetricProps {
  label: string
  value: string
}

export default function Metric({ label, value }: MetricProps) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate">{label}</div>
      <div className="mt-1.5 font-mono text-2xl font-bold text-navy">{value}</div>
    </div>
  )
}
