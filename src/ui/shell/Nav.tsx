import { useStore, type ViewKey } from '@/state/store'

const ITEMS: { key: ViewKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'corrida', label: 'Corrida' },
  { key: 'distribuidores', label: 'Distribuidores' },
  { key: 'cola', label: 'Cola de revisión' },
  { key: 'maestro', label: 'Maestro' },
  { key: 'config', label: 'Configuración' },
]

export default function Nav() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  return (
    <nav className="bg-navy text-panel flex flex-col w-56 shrink-0 min-h-screen">
      <div className="font-mono text-lg px-4 py-4 border-b border-line/20">Motor DTT</div>
      <ul className="flex flex-col">
        {ITEMS.map(({ key, label }) => {
          const active = view === key
          return (
            <li key={key}>
              <button
                type="button"
                data-testid={`nav-${key}`}
                onClick={() => setView(key)}
                className={`w-full text-left px-4 py-3 font-sans ${active ? 'bg-red text-panel' : 'text-panel/80 hover:bg-navy-deep'}`}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
