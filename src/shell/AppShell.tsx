import type { ComponentType, ReactNode } from 'react'
import { TOOLS } from '../registry/registry.ts'
import { GearIcon, SwatchIcon } from '../ui/icons.tsx'
import { hrefFor } from './router.ts'

type NavEntry = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  path: string
}

export function AppShell({
  path,
  title,
  children,
}: {
  path: string
  title: string
  children: ReactNode
}) {
  const tools: NavEntry[] = TOOLS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    path: `/${t.id}`,
  }))

  const shellEntries: NavEntry[] = [
    { id: 'theme', label: 'Theme', icon: SwatchIcon, path: '/theme' },
    { id: 'settings', label: 'Settings', icon: GearIcon, path: '/settings' },
  ]

  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 shrink-0 flex-col border-r border-line-soft bg-surface">
        <div className="flex h-14 items-center px-4">
          <span className="text-sm font-semibold tracking-wide text-ink">
            ARK<span className="text-accent"> Tools</span>
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-2">
          {tools.length > 0 && <NavGroup label="Tools" />}
          {tools.map((e) => (
            <NavItem key={e.id} entry={e} active={isActive(path, e.path)} />
          ))}
        </div>

        <div className="flex flex-col gap-1 p-2">
          {shellEntries.map((e) => (
            <NavItem key={e.id} entry={e} active={isActive(path, e.path)} />
          ))}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line-soft px-6">
          <h1 className="text-sm font-medium text-ink">{title}</h1>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}

function NavGroup({ label }: { label: string }) {
  return <div className="label-eyebrow px-3 pt-2 pb-1">{label}</div>
}

function NavItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = entry.icon
  return (
    <a
      href={hrefFor(entry.path)}
      aria-current={active ? 'page' : undefined}
      className={[
        'relative flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-surface-3 text-ink'
          : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <Icon className={active ? 'size-4.5 text-accent' : 'size-4.5'} />
      {entry.label}
    </a>
  )
}

function isActive(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}
