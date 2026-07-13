import { render, screen, fireEvent } from '@testing-library/react'
import Corrida from '@/ui/screens/Corrida'
import { useStore } from '@/state/store'

const BASE_RUN_RESULT = {
  summary: {
    fileName: 'real.csv', fileKind: 'csv' as const, totalRows: 5000, distributors: 12, bytes: 10,
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
}

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

test('done state with a run result shows an enabled export button that calls exportBase on click', () => {
  let called = 0
  useStore.setState((s) => ({
    ingest: {
      ...s.ingest,
      phase: 'done',
      summary: BASE_RUN_RESULT.summary,
    },
    runResult: BASE_RUN_RESULT,
    exportState: 'idle',
    exportBase: async () => { called++ },
  }))
  render(<Corrida />)
  const btn = screen.getByRole('button', { name: /descargar base estandarizada/i })
  expect(btn).toBeEnabled()
  fireEvent.click(btn)
  expect(called).toBe(1)
})

test('export button is disabled while a run has not produced a runResult yet', () => {
  useStore.setState((s) => ({
    ingest: { ...s.ingest, phase: 'done', summary: BASE_RUN_RESULT.summary },
    runResult: null,
    exportState: 'idle',
  }))
  render(<Corrida />)
  expect(screen.getByRole('button', { name: /descargar base estandarizada/i })).toBeDisabled()
})

test('export button shows a running indicator and is disabled while exporting', () => {
  useStore.setState((s) => ({
    ingest: { ...s.ingest, phase: 'done', summary: BASE_RUN_RESULT.summary },
    runResult: BASE_RUN_RESULT,
    exportState: 'running',
  }))
  render(<Corrida />)
  expect(screen.getByRole('button', { name: /generando/i })).toBeDisabled()
})

test('export button shows a done confirmation after a successful export', () => {
  useStore.setState((s) => ({
    ingest: { ...s.ingest, phase: 'done', summary: BASE_RUN_RESULT.summary },
    runResult: BASE_RUN_RESULT,
    exportState: 'done',
  }))
  render(<Corrida />)
  expect(screen.getByText(/descarga lista/i)).toBeInTheDocument()
})
