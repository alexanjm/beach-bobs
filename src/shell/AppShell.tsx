import type { ComponentType, ReactNode } from 'react'
import { TOOLS } from '../registry/registry.ts'
import { GearIcon, SwatchIcon } from '../ui/icons.tsx'
import { SyncBadge } from './SyncBadge.tsx'
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
    <div className="flex min-h-dvh">
      <nav className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line-soft bg-surface/70 md:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <PrismMark className="size-7 shrink-0" />
          <Wordmark />
        </div>
        <div className="prism-rule mx-4 h-px opacity-60" />

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
        {/* On phones the header sticks and clears the notch / status bar. */}
        <header className="sticky top-0 z-30 shrink-0 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md md:static md:bg-transparent md:pt-0 md:backdrop-blur-none">
          <div className="relative flex h-12 items-center justify-between gap-3 px-4 md:h-14 md:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <a href={hrefFor('/')} className="shrink-0 md:hidden" aria-label="Home">
                <PrismMark className="size-6" />
              </a>
              <h1 className="truncate font-display text-sm font-semibold tracking-[0.12em] text-ink uppercase">
                {title}
              </h1>
            </div>
            <SyncBadge />
            <div className="prism-rule absolute inset-x-0 bottom-0 h-px opacity-40" />
          </div>
        </header>
        <main className="min-h-0 flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6">
          {children}
        </main>
      </div>

      <TabBar entries={[...tools, ...shellEntries]} path={path} />
    </div>
  )
}

function Wordmark() {
  return (
    <span className="font-display text-[15px] font-bold tracking-[0.22em] text-ink uppercase">
      Ark
      <span className="ml-1.5 font-semibold tracking-[0.14em] text-accent-hi [text-shadow:0_0_12px_var(--color-accent-glow)]">
        Tools
      </span>
    </span>
  )
}

/* Phone navigation: thumb-reach tabs pinned to the bottom edge. */
function TabBar({ entries, path }: { entries: NavEntry[]; path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="prism-rule h-px opacity-50" />
      <div className="flex">
        {entries.map((e) => {
          const active = isActive(path, e.path)
          const Icon = e.icon
          return (
            <a
              key={e.id}
              href={hrefFor(e.path)}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
                active ? 'text-accent-hi' : 'text-ink-faint active:text-ink',
              ].join(' ')}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-hi shadow-[0_0_10px_1px_var(--color-accent-glow)]" />
              )}
              <Icon
                className={
                  active
                    ? 'size-5 drop-shadow-[0_0_6px_var(--color-accent-glow)]'
                    : 'size-5'
                }
              />
              {e.label}
            </a>
          )
        })}
      </div>
    </nav>
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
          ? 'bg-linear-to-r from-accent-dim to-surface-3/40 text-ink'
          : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent-hi shadow-[0_0_10px_1px_var(--color-accent-glow)]" />
      )}
      <Icon
        className={
          active
            ? 'size-4.5 text-accent-hi drop-shadow-[0_0_6px_var(--color-accent-glow)]'
            : 'size-4.5'
        }
      />
      {entry.label}
    </a>
  )
}

function isActive(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}

/*
  The app mark: a triangle of three tek plates — coral, amber, lime — around
  a white-hot core, sitting in a blue halo. A nod to the Ascended logo, not a
  copy of it.
*/
function PrismMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="prism-halo" cx="50%" cy="58%" r="50%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="prism-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-tek)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--color-tek)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="18" r="15" fill="url(#prism-halo)" />
      <circle
        cx="16"
        cy="18"
        r="11.5"
        fill="none"
        stroke="var(--color-accent-hi)"
        strokeOpacity="0.55"
        strokeWidth="0.75"
      />
      <rect x="15.4" y="1" width="1.2" height="16" fill="url(#prism-beam)" />
      {/* three plates, with a hairline gap at each corner */}
      <g strokeWidth="3.4" strokeLinecap="round" fill="none">
        <path d="M14.9 7.6 L6.3 22.6" stroke="var(--color-prism-coral)" />
        <path d="M17.1 7.6 L25.7 22.6" stroke="var(--color-prism-lime)" />
        <path d="M7.9 25.6 L24.1 25.6" stroke="var(--color-prism-amber)" />
      </g>
      {/* core */}
      <path d="M16 14 L19.6 20.8 L12.4 20.8 Z" fill="var(--color-tek)" opacity="0.9" />
    </svg>
  )
}
