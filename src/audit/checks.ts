import type { PipelineRunResult } from '@/contracts/pipeline'
import type { AuditCheck } from './contracts'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** Checks totals that should hold for every completed pipeline run. These are reported,
 * never used to rewrite or discard the underlying result. */
export function checkRunResult(result: PipelineRunResult): AuditCheck[] {
  const rows = result.summary.totalRows
  const segmentRows = sum(Object.values(result.segmento))
  const stateRows = sum(Object.values(result.estado))
  const percentages = [result.clasificacionPct, result.clasificacionCrudoPct, result.estadoValidoPct]
  const percentagesValid = percentages.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
  const reviewCount = result.clientesSinClasificar.length

  return [
    {
      id: 'segment-balance', passed: segmentRows === rows,
      expected: rows, actual: segmentRows,
      detail: 'La suma de métodos de segmento coincide con las filas procesadas.',
    },
    {
      id: 'state-balance', passed: stateRows === rows,
      expected: rows, actual: stateRows,
      detail: 'La suma de métodos de estado coincide con las filas procesadas.',
    },
    {
      id: 'percentage-range', passed: percentagesValid,
      expected: 'Tres porcentajes finitos entre 0 y 100',
      actual: percentagesValid ? 'Válidos' : percentages.join(', '),
      detail: 'Coberturas de segmento y estado dentro de rango.',
    },
    {
      id: 'review-bound', passed: reviewCount <= rows,
      expected: `Hasta ${rows}`, actual: reviewCount,
      detail: 'Los clientes pendientes no superan el número de filas.',
    },
  ]
}
