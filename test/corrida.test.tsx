import { render, screen } from '@testing-library/react'
import Corrida from '@/ui/screens/Corrida'
import { useStore } from '@/state/store'

test('shows live row/distributor counts from ingest state', () => {
  useStore.setState((s) => ({
    ingest: { ...s.ingest, phase: 'running', rows: 5000, distributors: 12, fileName: 'x.csv', summary: null, error: null },
  }))
  render(<Corrida />)
  expect(screen.getByText(/5\.?000|5,000/)).toBeInTheDocument()
  expect(screen.getByText(/12/)).toBeInTheDocument()
})

test('renders a drop zone when idle', () => {
  useStore.setState((s) => ({ ingest: { ...s.ingest, phase: 'idle' } }))
  render(<Corrida />)
  expect(screen.getByTestId('dropzone')).toBeInTheDocument()
})

test('done state shows real classification once a pipeline run has completed', () => {
  useStore.setState((s) => ({
    ingest: {
      ...s.ingest,
      phase: 'done',
      summary: {
        fileName: 'real.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10,
        schema: { rif: 'RIF', segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] },
        headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3,
      },
    },
    runResult: {
      summary: {
        fileName: 'real.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10,
        schema: { rif: 'RIF', segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] },
        headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3,
      },
      segmento: { MAESTRO: 0, EXACTO: 4500, FUZZY: 0, SIN_CLASIFICAR: 500 },
      clasificacionPct: 90,
      clasificacionCrudoPct: 92.4,
      estadoValidoPct: 98.1,
      tonTotal: 100,
      tonSinClasificar: 5,
      distribuidores: [],
      cola: [],
      maestro: [],
      maestroTotal: 0,
      conflictos: 0,
      recuperadosMaestro: 0,
    },
  }))
  render(<Corrida />)
  expect(screen.getByText(/clasificación 90%/)).toBeInTheDocument()
  expect(screen.getByText(/estado válido 98,1%/)).toBeInTheDocument()
})
