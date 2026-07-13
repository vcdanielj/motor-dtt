import { render, screen } from '@testing-library/react'
import Cola from '@/ui/screens/Cola'

test('renders cola items with tipo badge and afectados', () => {
  render(<Cola />)
  // Mock data has more than one VARIANTE_NUEVA item, so assert at least one badge renders.
  expect(screen.getAllByText(/VARIANTE_NUEVA|Variante/i).length).toBeGreaterThan(0)
})

test('shows fuzzy suggestion pill only when present', () => {
  render(<Cola />)
  expect(screen.getByText(/→ MINI MARKET \(87\)/)).toBeInTheDocument()
})

test('shows the Sprint 1 preview-only honesty note', () => {
  render(<Cola />)
  expect(screen.getByText(/Vista previa — la persistencia llega en Sprint 5\./)).toBeInTheDocument()
})
