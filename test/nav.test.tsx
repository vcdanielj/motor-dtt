import { render, screen, fireEvent } from '@testing-library/react'
import AppShell from '@/ui/shell/AppShell'
import { useStore } from '@/state/store'

test('clicking nav switches active view', () => {
  render(<AppShell />)
  fireEvent.click(screen.getByTestId('nav-cola'))
  expect(useStore.getState().view).toBe('cola')
})
