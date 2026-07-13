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
