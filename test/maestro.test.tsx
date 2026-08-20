import { render, screen } from '@testing-library/react'
import Maestro from '@/ui/screens/Maestro'

test('renders maestro entries with rif and segmento', () => {
  render(<Maestro />)
  // Exact match: multiple mock entries have a RIF starting with "J-", so getByText(/^J-/)
  // would be ambiguous. This still proves store wiring (rif rendered from useStore().maestro).
  expect(screen.getByText('J-00123456-7')).toBeInTheDocument()
  expect(screen.getByText('Bodegas')).toBeInTheDocument() // segmentoN3
})
