import { render, screen } from '@testing-library/react'
import Distribuidores from '@/ui/screens/Distribuidores'

test('lists distributors with SCDC crudo/post', () => {
  render(<Distribuidores />)
  expect(screen.getByText('EXCELSIOR RK')).toBeInTheDocument()
  // Exact match (not /31/) — "22.310" (another row's registros) also contains "31" as a substring.
  expect(screen.getByText('31')).toBeInTheDocument() // scdcCrudo
})

test('shows the SCDC-over-crudo honesty note', () => {
  render(<Distribuidores />)
  expect(screen.getByText(/SCDC calculado sobre el crudo \(D5\) — no refleja rescates del motor\./)).toBeInTheDocument()
})
