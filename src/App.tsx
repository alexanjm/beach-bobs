import type { ReactNode } from 'react'
import { TOOLS } from './registry/registry.ts'
import { AppShell } from './shell/AppShell.tsx'
import { ThemeScreen } from './shell/ThemeScreen.tsx'
import { hrefFor, match, useHashPath } from './shell/router.ts'

export function App() {
  const path = useHashPath()
  const resolved = resolve(path)
  return (
    <AppShell path={path} title={resolved.title}>
      {resolved.element}
    </AppShell>
  )
}

type Resolved = { title: string; element: ReactNode }

function resolve(path: string): Resolved {
  if (match('/', path)) return { title: 'Home', element: <Home /> }
  if (match('/theme', path)) return { title: 'Theme', element: <ThemeScreen /> }
  if (match('/settings', path))
    return { title: 'Settings', element: <SettingsPlaceholder /> }

  for (const tool of TOOLS) {
    for (const route of tool.routes) {
      const pattern = `/${tool.id}/${route.path}`
      if (match(pattern, path)) {
        return { title: tool.label, element: route.element }
      }
    }
  }

  return { title: 'Not found', element: <NotFound path={path} /> }
}

function Home() {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-lg text-ink">ARK Tools</h2>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        {TOOLS.length === 0
          ? 'No tools registered yet. The shell, router and theme are up — tools land next.'
          : 'Pick a tool from the sidebar.'}
      </p>
      <a
        href={hrefFor('/theme')}
        className="mt-4 inline-block text-sm text-accent hover:text-accent-hi"
      >
        View the palette →
      </a>
    </div>
  )
}

function SettingsPlaceholder() {
  return (
    <p className="text-sm text-ink-muted">
      Settings lands with the persistence layer — token, display name, and a
      download-everything button.
    </p>
  )
}

function NotFound({ path }: { path: string }) {
  return (
    <div className="text-sm text-ink-muted">
      Nothing at <code className="font-mono text-ink">{path}</code>.{' '}
      <a href={hrefFor('/')} className="text-accent hover:text-accent-hi">
        Go home
      </a>
    </div>
  )
}
