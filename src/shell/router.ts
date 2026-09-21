import { useEffect, useState } from 'react'

/*
  Hash routing, hand-rolled. ~50 lines instead of a router dependency.

  Hash routing rather than history routing because GitHub Pages serves static
  files: a deep link to /scouting/abc would 404 before the app ever loads, and
  the usual fix is a 404.html that fakes a redirect. Hashes sidestep all of it.
*/

export function useHashPath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '')
  return normalise(raw)
}

export function navigate(path: string): void {
  window.location.hash = normalise(path)
}

export function hrefFor(path: string): string {
  return `#${normalise(path)}`
}

function normalise(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '')
  return `/${trimmed}`
}

/**
 * Match a path against a pattern. Segments beginning with `:` capture.
 * Returns the captured params, or null if the pattern does not match.
 *
 *   match('/servers/:id', '/servers/abc')  ->  { id: 'abc' }
 *   match('/servers', '/servers/abc')      ->  null
 */
export function match(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const pat = segments(pattern)
  const act = segments(path)
  if (pat.length !== act.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < pat.length; i++) {
    const p = pat[i]!
    const a = act[i]!
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(a)
    else if (p !== a) return null
  }
  return params
}

function segments(path: string): string[] {
  return normalise(path)
    .split('/')
    .filter((s) => s.length > 0)
}
