import { createContext, useContext, type ReactNode } from 'react'

/** Params captured by the matched route, e.g. ':serverId'. */
const RouteParams = createContext<Record<string, string>>({})

export function RouteParamsProvider({
  params,
  children,
}: {
  params: Record<string, string>
  children: ReactNode
}) {
  return <RouteParams.Provider value={params}>{children}</RouteParams.Provider>
}

export function useParams(): Record<string, string> {
  return useContext(RouteParams)
}

export function useParam(name: string): string | null {
  return useParams()[name] ?? null
}
