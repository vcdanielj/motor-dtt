import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AppShell from '@/ui/shell/AppShell'

interface PromptEventMock extends Event {
  prompt: ReturnType<typeof vi.fn>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

test('shows the install CTA when the browser exposes beforeinstallprompt', async () => {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const installEvent = new Event('beforeinstallprompt') as PromptEventMock
  installEvent.preventDefault = vi.fn()
  installEvent.prompt = prompt
  installEvent.userChoice = Promise.resolve({ outcome: 'accepted' })

  render(<AppShell />)
  act(() => {
    window.dispatchEvent(installEvent)
  })

  const button = await screen.findByTestId('install-app')
  fireEvent.click(button)

  await waitFor(() => {
    expect(prompt).toHaveBeenCalledTimes(1)
  })
})

test('shows iOS installation guidance when running on Safari without prompt support', () => {
  const originalUserAgent = navigator.userAgent

  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    configurable: true,
  })

  render(<AppShell />)

  expect(screen.getByText(/Añadir a pantalla de inicio/i)).toBeInTheDocument()

  Object.defineProperty(window.navigator, 'userAgent', {
    value: originalUserAgent,
    configurable: true,
  })
})
