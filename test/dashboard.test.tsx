import { render, screen } from '@testing-library/react'
import Dashboard from '@/ui/screens/Dashboard'

test('renders headline KPIs from store', () => {
  render(<Dashboard />)
  expect(screen.getByText(/92,4%|92\.4%/)).toBeInTheDocument()
  expect(screen.getByText('740.009')).toBeInTheDocument()
})
