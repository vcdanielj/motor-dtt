import { useCallback, useEffect, useMemo, useState } from 'react'

type InstallOutcome = 'accepted' | 'dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: InstallOutcome }>
}

interface InstallPromptState {
  canInstall: boolean
  isInstalled: boolean
  isIosSafari: boolean
  install: () => Promise<InstallOutcome | null>
}

function detectIosSafari(ua: string): boolean {
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua)
  return isIos && isSafari
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false

  if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

export function useInstallPrompt(): InstallPromptState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => detectStandalone())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setPromptEvent(null)
      setIsInstalled(true)
    }

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null
    const handleDisplayModeChange = (evt: MediaQueryListEvent) => {
      if (evt.matches) {
        setPromptEvent(null)
        setIsInstalled(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return null

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setPromptEvent(null)
    }
    return choice.outcome
  }, [promptEvent])

  const isIosSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return detectIosSafari(navigator.userAgent)
  }, [])

  return {
    canInstall: promptEvent !== null && !isInstalled,
    isInstalled,
    isIosSafari: isIosSafari && !isInstalled,
    install,
  }
}
