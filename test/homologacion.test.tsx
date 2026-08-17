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
