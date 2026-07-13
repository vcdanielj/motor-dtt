import { render, screen } from '@testing-library/react'
import Config from '@/ui/screens/Config'

test('shows seed provenance and official catalog confirmation', () => {
  render(<Config />)
  expect(screen.getByText(/Entregable 2\.1|oficial/i)).toBeInTheDocument()
  expect(screen.getByText(/37/)).toBeInTheDocument() // 37 N3 count
  expect(screen.queryByText(/PLACEHOLDER/)).not.toBeInTheDocument()
})
