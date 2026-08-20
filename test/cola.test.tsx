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
  sugerenciaFuzzy: { valor: 'SMI - Mini Market', score: 87 },
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
  expect(screen.getByText(/Usar sugerencia: SMI - Mini Market \(87\)/)).toBeInTheDocument()
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
  // 14 official N3 + the placeholder option
  expect(options.length).toBeGreaterThan(14)

  const saveButtons = screen.getAllByRole('button', { name: /Guardar clasificación/i })
  expect(saveButtons[0]).toBeDisabled()
})

test('clicking "Usar sugerencia" pre-selects that N3 and enables the save button', () => {
  render(<Cola />)
  fireEvent.click(screen.getByText(/Usar sugerencia: SMI - Mini Market \(87\)/))

  const saveButtons = screen.getAllByRole('button', { name: /Guardar clasificación/i })
  expect(saveButtons[0]).toBeEnabled()
})

test('clicking "Guardar clasificación" calls resolveColaItem with the item id and chosen N3, then shows a toast', async () => {
  let calledWith: [string, string] | null = null
  useStore.setState({ resolveColaItem: async (id, segmentoN3) => { calledWith = [id, segmentoN3] } })

  render(<Cola />)
  fireEvent.click(screen.getByText(/Usar sugerencia: SMI - Mini Market \(87\)/))
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

  expect(calledWith).toEqual(['test-variante', 'SMI - Mini Market'])
  expect(screen.getByRole('status')).toHaveTextContent(/CANAL RARO XYZ.*SMI - Mini Market.*guardado/)
})

test('an already-resolved item renders a resolved badge with the chosen segment, and hides the picker', () => {
  useStore.setState({
    cola: [{ ...VARIANTE_ITEM, resolucion: 'SMI - Mini Market' }, CONFLICTO_ITEM],
  })
  render(<Cola />)

  expect(screen.getByText(/Resuelto → SMI - Mini Market/)).toBeInTheDocument()
  // The resolved item's picker/save button is gone; only the still-pending CONFLICTO item's remain.
  expect(screen.getAllByRole('combobox')).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: /Guardar clasificación/i })).toHaveLength(1)
})

test('empty cola shows the empty state', () => {
  useStore.setState({ cola: [] })
  render(<Cola />)
  expect(screen.getByText(/No hay elementos en la cola de revisión\./)).toBeInTheDocument()
})

test('an ESTADO item offers the 24 estados, not the segment catalog', () => {
  useStore.setState({
    cola: [{
      id: 'e1',
      dominio: 'ESTADO',
      tipo: 'ESTADO_VARIANTE_NUEVA',
      valorCrudo: 'NVA ESPARTAA',
      registrosAfectados: 10,
      tonAfectadas: 4,
      sugerenciaFuzzy: { valor: 'NUEVA ESPARTA', score: 88 },
      resolucion: null,
    }],
  })
  render(<Cola />)

  const select = screen.getByLabelText(/Clasificar como… \(NVA ESPARTAA\)/)
  const options = within(select).getAllByRole('option').map((o) => o.textContent)
  expect(options).toContain('ZULIA')
  expect(options).toContain('NUEVA ESPARTA')
  expect(options).not.toContain('Bodegas')
  expect(screen.getByText(/Usar sugerencia: NUEVA ESPARTA \(88\)/)).toBeInTheDocument()
})

test('the domain filter narrows the list and the counts reflect both domains', () => {
  useStore.setState({
    cola: [
      { id: 's1', dominio: 'SEGMENTO', tipo: 'ALTO_VOLUMEN_SIN_CLASIFICAR', valorCrudo: 'TIENDA X', registrosAfectados: 1, tonAfectadas: 9, sugerenciaFuzzy: null, resolucion: null },
      { id: 'e1', dominio: 'ESTADO', tipo: 'ESTADO_SIN_RESOLVER', valorCrudo: 'ZONA X', registrosAfectados: 1, tonAfectadas: 1, sugerenciaFuzzy: null, resolucion: null },
    ],
  })
  render(<Cola />)

  expect(screen.getByRole('button', { name: /Todos \(2\)/ })).toBeInTheDocument()
  expect(screen.getByText('TIENDA X')).toBeInTheDocument()
  expect(screen.getByText('ZONA X')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Estado \(1\)/ }))
  expect(screen.queryByText('TIENDA X')).not.toBeInTheDocument()
  expect(screen.getByText('ZONA X')).toBeInTheDocument()
})
