import { useCanWrite, useToken } from '../sync/settings.ts'
import { hrefFor } from './router.ts'

/**
 * Read-only is a first-class state, not an error. Everything is browsable
 * before either of us has done any setup at all.
 */
export function ReadOnlyNotice() {
  const canWrite = useCanWrite()
  const hasToken = useToken() !== ''
  if (canWrite) return null

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-panel bg-surface-2 px-4 py-3">
      <p className="text-sm text-ink-muted">
        {hasToken
          ? 'Set your name in settings before you can add anything — records are attributed.'
          : 'Browsing read-only. Add a GitHub token to make changes.'}
      </p>
      <a
        href={hrefFor('/settings')}
        className="shrink-0 text-sm text-accent hover:text-accent-hi"
      >
        Settings →
      </a>
    </div>
  )
}
