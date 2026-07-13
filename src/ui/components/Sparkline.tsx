interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}

export default function Sparkline({ values, width = 100, height = 24, stroke = '#0F2B5B' }: SparklineProps) {
  if (values.length === 0) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" />
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0

  const points = values
    .map((v, i) => {
      const x = values.length > 1 ? i * step : width / 2
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  )
}
