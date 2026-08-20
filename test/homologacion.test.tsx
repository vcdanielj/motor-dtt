import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import Homologacion from '@/ui/screens/Homologacion'
import { useStore } from '@/state/store'

describe('Homologacion Screen', () => {
  beforeEach(async () => {
    await useStore.getState().resetLearned()
  })

  it('renders header, metrics and empty state when no aliases exist', () => {
    render(<Homologacion />)
    expect(screen.getByText('Homologación de Códigos (Alias)')).toBeInTheDocument()
    expect(screen.getByText('Códigos Homologados')).toBeInTheDocument()
    expect(screen.getByText('No hay códigos de clientes homologados aún')).toBeInTheDocument()
  })

  it('allows registering a new alias through the modal', async () => {
    render(<Homologacion />)
    
    // Open modal
    fireEvent.click(screen.getByRole('button', { name: '+ Registrar Alias' }))
    expect(screen.getByText('Registrar Homologación de Código')).toBeInTheDocument()

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Ej: ALIMENTOS CAMPESINO o SUPLIMOS'), {
      target: { value: 'ALIMENTOS CAMPESINO' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: BAR-00236 o CLI-109'), {
      target: { value: 'BAR-00236' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: J-402116012'), {
      target: { value: 'J-402116012' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: EMBUTIDOS CASA ITALIA C.A.'), {
      target: { value: 'EMBUTIDOS CASA ITALIA C.A.' },
    })

    // Submit
    fireEvent.click(screen.getByText('Guardar Homologación'))

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'BAR-00236' })).toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'ALIMENTOS CAMPESINO' })).toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'EMBUTIDOS CASA ITALIA C.A.' })).toBeInTheDocument()
    })
  })
})

describe('Homologacion Screen — validación de RIF', () => {
  it('rechaza un RIF claramente inválido con un aviso y no guarda el alias', async () => {
    await useStore.getState().resetLearned()
    render(<Homologacion />)

    fireEvent.click(screen.getByRole('button', { name: '+ Registrar Alias' }))
    fireEvent.change(screen.getByPlaceholderText('Ej: ALIMENTOS CAMPESINO o SUPLIMOS'), {
      target: { value: 'CAMPESINO' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: BAR-00236 o CLI-109'), {
      target: { value: 'BAR-00236' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: J-402116012'), {
      target: { value: 'no aplica' },
    })
    fireEvent.click(screen.getByText('Guardar Homologación'))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/no parece un RIF válido/)
    })
    // The modal stays open and nothing was persisted.
    expect(screen.getByText('Registrar Homologación de Código')).toBeInTheDocument()
    expect(useStore.getState().learnedAliasesList).toHaveLength(0)
  })

  it('normaliza el RIF al guardar (J-402.116.012 → J402116012)', async () => {
    await useStore.getState().resetLearned()
    render(<Homologacion />)

    fireEvent.click(screen.getByRole('button', { name: '+ Registrar Alias' }))
    fireEvent.change(screen.getByPlaceholderText('Ej: ALIMENTOS CAMPESINO o SUPLIMOS'), {
      target: { value: 'CAMPESINO' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: BAR-00236 o CLI-109'), {
      target: { value: 'BAR-00300' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ej: J-402116012'), {
      target: { value: 'j-402.116.012' },
    })
    fireEvent.click(screen.getByText('Guardar Homologación'))

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'J402116012' })).toBeInTheDocument()
    })
  })
})
