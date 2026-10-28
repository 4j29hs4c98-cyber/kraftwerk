import { NavLink, Outlet } from 'react-router'
import type { ComponentType, SVGProps } from 'react'
import { Logo } from '../components/Logo'
import { SyncStatus } from '../components/SyncStatus'
import { IconFood, IconPlan, IconProfile, IconProgress, IconToday } from './icons'

interface Tab {
  readonly to: string
  readonly label: string
  readonly Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const TABS: readonly Tab[] = [
  { to: '/heute', label: 'Heute', Icon: IconToday },
  { to: '/plan', label: 'Plan', Icon: IconPlan },
  { to: '/ernaehrung', label: 'Ernährung', Icon: IconFood },
  { to: '/fortschritt', label: 'Fortschritt', Icon: IconProgress },
  { to: '/profil', label: 'Profil', Icon: IconProfile },
]

export function AppLayout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Seitenleiste ab Tablet-Breite */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <Logo className="px-2" />
        <nav aria-label="Hauptnavigation" className="mt-8 flex flex-col gap-1">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium transition ${isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'}`
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">
        <SyncStatus className="mb-4" />
        <Outlet />
      </main>

      {/* Untere Tab-Leiste auf dem Handy */}
      <nav aria-label="Hauptnavigation" className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${isActive ? 'text-accent' : 'text-muted'}`
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
