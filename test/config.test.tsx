import { render, screen, fireEvent } from '@testing-library/react'
import Config from '@/ui/screens/Config'
import { useStore } from '@/state/store'

test('shows seed provenance and official catalog confirmation', () => {
  render(<Config />)
  expect(screen.getByText(/Entregable 2\.1|oficial/i)).toBeInTheDocument()
  expect(screen.getByText(/37/)).toBeInTheDocument() // 37 N3 count
  expect(screen.queryByText(/PLACEHOLDER/)).not.toBeInTheDocument()
})

test('shows the persisted-learning panel with counts from the store (0 with no IndexedDB in tests)', () => {
  render(<Config />)
  expect(screen.getByText('Aprendizaje persistido')).toBeInTheDocument()
  expect(screen.getByText('Entradas de diccionario aprendidas')).toBeInTheDocument()
  expect(screen.getByText('Clasificaciones manuales de maestro')).toBeInTheDocument()
})

test('shows editable threshold inputs seeded from the store, plus the save button', () => {
  useStore.setState({ thresholds: { fuzzyThreshold: 92, fuzzySuggestFloor: 80 } })
  render(<Config />)
  const thresholdInput = screen.getByLabelText('Umbral fuzzy') as HTMLInputElement
  const floorInput = screen.getByLabelText('Piso de sugerencia') as HTMLInputElement
  expect(thresholdInput.value).toBe('92')
  expect(floorInput.value).toBe('80')
  expect(screen.getByRole('button', { name: 'Guardar umbrales' })).toBeInTheDocument()
})

test('shows the export/import/reset learning controls', () => {
  render(<Config />)
  expect(screen.getByRole('button', { name: 'Exportar diccionario' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar maestro' })).toBeInTheDocument()
  expect(screen.getByText('Importar diccionario (CSV)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Restablecer aprendizaje' })).toBeInTheDocument()
})

test('reset learning is gated behind a two-click inline confirm (no native confirm/alert)', () => {
  const originalConfirm = window.confirm
  const originalAlert = window.alert
  let confirmCalled = false
  let alertCalled = false
  window.confirm = () => { confirmCalled = true; return true }
  window.alert = () => { alertCalled = true }

  render(<Config />)
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer aprendizaje' }))

  expect(screen.getByRole('button', { name: 'Sí, restablecer' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  expect(confirmCalled).toBe(false)
  expect(alertCalled).toBe(false)

  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('button', { name: 'Sí, restablecer' })).not.toBeInTheDocument()

  window.confirm = originalConfirm
  window.alert = originalAlert
})
