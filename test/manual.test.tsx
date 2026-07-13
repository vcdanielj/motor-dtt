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
  expect(screen.getByText(/Cómo resuelve el segmento/i)).toBeInTheDocument()
  expect(screen.getByText(/Entender el SCDC/i)).toBeInTheDocument()
  expect(screen.getByText('740.009')).toBeInTheDocument()
  expect(screen.getByText(/Privacidad de los datos/i)).toBeInTheDocument()
  expect(screen.getByText(/Local-first, sin excepciones/i)).toBeInTheDocument()
})
