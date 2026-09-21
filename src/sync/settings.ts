import { useSyncExternalStore } from 'react'

/*
  Per-device settings: the GitHub token and the display name that lands in
  createdBy/updatedBy. Both live in localStorage and are never committed.

  Identity is deliberately separate from auth. Git attribution ends up in a
  commit log neither of us will open; the name we care about is the one on
  the map pin.
*/

const TOKEN_KEY = 'arktools.token'
const IDENTITY_KEY = 'arktools.identity'

export const KNOWN_IDENTITIES = ['alex', 'kimani'] as const

type Listener = () => void
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  // Another tab on the same device changing settings counts too.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Private browsing with storage disabled. The app still works, it just
    // forgets on reload.
  }
  emit()
}

export function getToken(): string {
  return read(TOKEN_KEY)
}

export function setToken(token: string) {
  write(TOKEN_KEY, token.trim())
}

export function getIdentity(): string {
  return read(IDENTITY_KEY)
}

export function setIdentity(name: string) {
  write(IDENTITY_KEY, name.trim())
}

export function useToken(): string {
  return useSyncExternalStore(subscribe, getToken, () => '')
}

export function useIdentity(): string {
  return useSyncExternalStore(subscribe, getIdentity, () => '')
}

/** Writes need both a token and a name to attribute the record to. */
export function useCanWrite(): boolean {
  return useToken() !== '' && useIdentity() !== ''
}
