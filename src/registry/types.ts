import type { ComponentType, ReactNode } from 'react'

/*
  The seam. A tool is a folder that exports one of these and gets added to the
  array in registry.ts. Nav, routing and the settings screen all derive from
  the registry, so adding a tool touches nothing else.
*/

export interface ToolRoute {
  /** Relative to the tool's base path. '' is the tool's index. ':id' captures. */
  path: string
  element: ReactNode
}

export interface CollectionSpec<T = unknown> {
  /** Directory under /data. 'locations' -> data/locations/<id>.json */
  name: string
  /** Validate one record off the index. Return null to drop it with a warning. */
  parse: (raw: unknown, path: string) => T | null
}

export interface ToolModule {
  /** Route base and registry key. 'scouting' -> #/scouting */
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  routes: ToolRoute[]
  /** Declared for client-side parsing. The index builder discovers dirs itself. */
  collections?: CollectionSpec[]
  /** Rendered as a section inside the shared settings screen. */
  SettingsPanel?: ComponentType
}
