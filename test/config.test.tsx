import { render, screen } from '@testing-library/react'
import Config from '@/ui/screens/Config'

test('shows seed provenance and placeholder warning', () => {
  render(<Config />)
  expect(screen.getByText(/PLACEHOLDER|placeholder/i)).toBeInTheDocument()
  expect(screen.getByText(/35/)).toBeInTheDocument() // 35 N3 count
})
