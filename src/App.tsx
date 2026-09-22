import { useEffect, type ReactNode } from 'react'
import { TOOLS } from './registry/registry.ts'
import { AppShell } from './shell/AppShell.tsx'
import { ConflictDialog } from './shell/ConflictDialog.tsx'
import { FailedWrites } from './shell/FailedWrites.tsx'
import { RouteParamsProvider } from './shell/RouteParams.tsx'
import { SettingsScreen } from './shell/SettingsScreen.tsx'
import { ThemeScreen } from './shell/ThemeScreen.tsx'
import { hrefFor, match, useHashPath } from './shell/router.ts'
import { startSync } from './sync/store.ts'

export function App() {
  const path = useHashPath()
  const resolved = resolve(path)

  useEffect(startSync, [])

  return (
    <AppShell path={path} title={resolved.title}>
      <FailedWrites />
      <RouteParamsProvider params={resolved.params}>
        {resolved.element}
      </RouteParamsProvider>
      <ConflictDialog />
    </AppShell>
  )
}

type Resolved = {
  title: string
  element: ReactNode
  params: Record<string, string>
}

function resolve(path: string): Resolved {
  const shell = (title: string, element: ReactNode): Resolved => ({
    title,
    element,
    params: {},
  })

  if (match('/', path)) return shell('Home', <Home />)
  if (match('/theme', path)) return shell('Theme', <ThemeScreen />)
  if (match('/settings', path)) return shell('Settings', <SettingsScreen />)

  for (const tool of TOOLS) {
    for (const route of tool.routes) {
      const params = match(`/${tool.id}/${route.path}`, path)
      if (params) return { title: tool.label, element: route.element, params }
    }
  }

  return shell('Not found', <NotFound path={path} />)
}

function Home() {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-lg text-ink">ARK Tools</h2>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Pick a tool from the menu. Everything is readable without setup; add
        a token in settings when you want to change something.
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
