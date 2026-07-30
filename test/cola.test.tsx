import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { useStore } from '@/state/store'
import Cola from '@/ui/screens/Cola'
import type { ColaItem } from '@/contracts/cola'

const VARIANTE_ITEM: ColaItem = {
  id: 'test-variante',
  dominio: 'SEGMENTO',
  tipo: 'VARIANTE_NUEVA',
  valorCrudo: 'CANAL RARO XYZ',
  registrosAfectados: 10,
  tonAfectadas: 1.2,
  sugerenciaFuzzy: { valor: 'MINI MARKET', score: 87 },
  resolucion: null,
}

const CONFLICTO_ITEM: ColaItem = {
  id: 'test-conflicto',
  dominio: 'SEGMENTO',
  tipo: 'CONFLICTO_MAYOR',
  valorCrudo: 'J-12345678-9',
  registrosAfectados: 5,
  tonAfectadas: 0.5,
  sugerenciaFuzzy: null,
  resolucion: null,
}

const REAL_RESOLVE_COLA_ITEM = useStore.getState().resolveColaItem

beforeEach(() => {
  useStore.setState({ cola: [VARIANTE_ITEM, CONFLICTO_ITEM], resolveColaItem: REAL_RESOLVE_COLA_ITEM })
})

test('renders cola items with tipo badge and afectados', () => {
  render(<Cola />)
  expect(screen.getAllByText(/VARIANTE_NUEVA|Variante/i).length).toBeGreaterThan(0)
})

test('shows a quick suggestion button only when sugerenciaFuzzy is present', () => {
  render(<Cola />)
  expect(screen.getByText(/Usar sugerencia: MINI MARKET \(87\)/)).toBeInTheDocument()
  expect(screen.getByText(/sin sugerencia fuzzy/)).toBeInTheDocument()
})

test('shows the persistence honesty note (no Sprint 5 disclaimer)', () => {
  render(<Cola />)
  expect(
    screen.getByText(/Las clasificaciones se guardan localmente y se aplican en la próxima corrida\./),
  ).toBeInTheDocument()
  expect(screen.queryByText(/persistencia llega en Sprint 5/)).not.toBeInTheDocument()
})

test('renders a segment <select> grouped by macro and a save button, disabled until a segment is chosen', () => {
  render(<Cola />)
  const selects = screen.getAllByRole('combobox')
  expect(selects.length).toBeGreaterThan(0)
  const options = within(selects[0]).getAllByRole('option')
  // 37 N3 + the placeholder option
  expect(options.length).toBeGreaterThan(37)

  const saveButtons = screen.getAllByRole('button', { name: /Guardar clasificación/i })
  expect(saveButtons[0]).toBeDisabled()
})

test('clicking "Usar sugerencia" pre-selects that N3 and enables the save button', () => {
  render(<Cola />)
  fireEvent.click(screen.getByText(/Usar sugerencia: MINI MARKET \(87\)/))

  const saveButtons = screen.getAllByRole('button', { name: /Guardar clasificación/i })
  expect(saveButtons[0]).toBeEnabled()
})

test('clicking "Guardar clasificación" calls resolveColaItem with the item id and chosen N3, then shows a toast', async () => {
  let calledWith: [string, string] | null = null
  useStore.setState({ resolveColaItem: async (id, segmentoN3) => { calledWith = [id, segmentoN3] } })

  render(<Cola />)
  fireEvent.click(screen.getByText(/Usar sugerencia: MINI MARKET \(87\)/))
  const saveButtons = screen.getAllByRole('button', { name: /Guardar clasificación/i })

  // Flush the microtasks handleSave awaits (resolveColaItem's promise + its .then/.finally
  // continuation) inside a single act() so React's state updates land wrapped, not leaked
  // into whatever runs after this test.
  await act(async () => {
    fireEvent.click(saveButtons[0])
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(calledWith).toEqual(['test-variante', 'MINI MARKET'])
  expect(screen.getByRole('status')).toHaveTextContent(/CANAL RARO XYZ.*MINI MARKET.*guardado/)
})

test('an already-resolved item renders a resolved badge with the chosen segment, and hides the picker', () => {
  useStore.setState({
    cola: [{ ...VARIANTE_ITEM, resolucion: 'MINI MARKET' }, CONFLICTO_ITEM],
  })
  render(<Cola />)

  expect(screen.getByText(/Resuelto → MINI MARKET/)).toBeInTheDocument()
  // The resolved item's picker/save button is gone; only the still-pending CONFLICTO item's remain.
  expect(screen.getAllByRole('combobox')).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: /Guardar clasificación/i })).toHaveLength(1)
})

test('empty cola shows the empty state', () => {
  useStore.setState({ cola: [] })
  render(<Cola />)
  expect(screen.getByText(/No hay elementos en la cola de revisión\./)).toBeInTheDocument()
})
