import { hrefFor, useHashPath } from '../../shell/router.ts'

const TABS = [
  { path: '/scouting', label: 'Servers' },
  { path: '/scouting/maps', label: 'Maps' },
]

export function ScoutingNav() {
  const path = useHashPath()
  return (
    <div className="mb-4 flex gap-1">
      {TABS.map((tab) => {
        const active =
          tab.path === '/scouting'
            ? path === '/scouting' || path.startsWith('/scouting/s/')
            : path.startsWith(tab.path)
        return (
          <a
            key={tab.path}
            href={hrefFor(tab.path)}
            className={[
              'rounded-control px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-accent-dim text-accent-hi ring-1 ring-accent/40 ring-inset shadow-[0_0_14px_-4px_var(--color-accent-glow)]'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </a>
        )
      })}
    </div>
  )
}
