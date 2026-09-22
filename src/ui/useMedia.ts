import { useSyncExternalStore } from 'react'

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Below Tailwind's `md` breakpoint — the phone layout. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767.98px)')
}

/** Touch-first device, where autofocus means a keyboard covering the screen. */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)')
}
