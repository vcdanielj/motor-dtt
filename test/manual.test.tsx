import { render, screen, fireEvent } from '@testing-library/react'
import AppShell from '@/ui/shell/AppShell'
import Manual from '@/ui/screens/Manual'
import { useStore } from '@/state/store'

test('clicking nav-manual switches the active view to manual', () => {
  render(<AppShell />)
  fireEvent.click(screen.getByTestId('nav-manual'))
  expect(useStore.getState().view).toBe('manual')
})

test('renders key manual content: cascade heading, SCDC and privacy', () => {
  render(<Manual />)
  expect(screen.getAllByText(/Cómo resuelve el segmento/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Entender el SCDC/i).length).toBeGreaterThan(0)
  expect(screen.getByText('740.009')).toBeInTheDocument()
  expect(screen.getAllByText(/Privacidad de los datos/i).length).toBeGreaterThan(0)
  expect(screen.getByText(/Local-first, sin excepciones/i)).toBeInTheDocument()
})
