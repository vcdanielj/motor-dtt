import { useState } from 'react'
import { useStore } from '@/state/store'
import { detectBrowser } from '@/lib/browser'
import { useInstallPrompt } from '@/pwa/useInstallPrompt'
import Nav from '@/ui/shell/Nav'
import Dashboard from '@/ui/screens/Dashboard'
import Corrida from '@/ui/screens/Corrida'
import Distribuidores from '@/ui/screens/Distribuidores'
import Cola from '@/ui/screens/Cola'
import Maestro from '@/ui/screens/Maestro'
import Config from '@/ui/screens/Config'
import Manual from '@/ui/screens/Manual'

const SCREENS = {
  dashboard: Dashboard,
  corrida: Corrida,
  distribuidores: Distribuidores,
  cola: Cola,
  maestro: Maestro,
  config: Config,
  manual: Manual,
}

export default function AppShell() {
  const view = useStore((s) => s.view)
  const [dismissed, setDismissed] = useState(false)
  const { warnings } = detectBrowser()
  const { canInstall, isIosSafari, install } = useInstallPrompt()
  const Screen = SCREENS[view]

  return (
    <div className="flex min-h-screen bg-bg text-ink font-sans">
      <Nav />
      <div className="flex-1 flex flex-col">
        {(canInstall || isIosSafari) && (
          <div className="bg-navy text-panel px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Instala Motor DTT para usarlo como app descargable.</span>
              {canInstall ? (
                <span className="text-panel/80">Se abrirá el diálogo del navegador para instalarla.</span>
              ) : (
                <span className="text-panel/80">En Safari toca Compartir y luego Añadir a pantalla de inicio.</span>
              )}
            </div>
            {canInstall && (
              <button
                type="button"
                data-testid="install-app"
                onClick={() => void install()}
                className="shrink-0 rounded-md bg-panel px-4 py-2 font-medium text-navy hover:bg-panel/90"
              >
                Instalar app
              </button>
            )}
          </div>
        )}
        {warnings.length > 0 && !dismissed && (
          <div className="bg-amber text-ink px-4 py-2 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              {warnings.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setDismissed(true)}
              className="font-mono"
            >
              ×
            </button>
          </div>
        )}
        <main className="flex-1 p-8">
          <Screen />
        </main>
      </div>
    </div>
  )
}
