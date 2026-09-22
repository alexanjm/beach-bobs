import { useEffect, useState } from 'react'
import { refresh, useSync } from '../sync/store.ts'
import { RefreshIcon } from '../ui/icons.tsx'
import { hrefFor } from './router.ts'

/*
  Sync state, always on screen, never optimistic. "Saved" is only ever shown
  for a write GitHub actually accepted.
*/

export function SyncBadge() {
  const sync = useSync()
  const tick = useTicker(30_000)

  const { tone, text } = describe(sync, tick)

  return (
    <div className="flex items-center gap-3">
      {sync.pendingWrites > 0 && (
        <span
          className="hidden text-xs text-ink-faint sm:inline"
          title="Saved to GitHub. Waiting for the index rebuild to pick it up."
        >
          {sync.pendingWrites} awaiting index
        </span>
      )}

      <span className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: tone }}
          aria-hidden="true"
        />
        <span className="max-w-[40vw] truncate md:max-w-xs">{text}</span>
      </span>

      {sync.lastError?.kind === 'auth' && (
        <a
          href={hrefFor('/settings')}
          className="text-xs text-accent hover:text-accent-hi"
        >
          Fix token
        </a>
      )}

      <button
        onClick={() => void refresh()}
        disabled={sync.status === 'loading'}
        title="Refresh from GitHub"
        className="rounded-control p-2 text-ink-muted md:p-1.5 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
      >
        <RefreshIcon
          className={`size-4 ${sync.status === 'loading' ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  )
}

function describe(sync: ReturnType<typeof useSync>, _tick: number) {
  if (sync.status === 'saving') {
    return { tone: 'var(--color-warn)', text: 'Saving…' }
  }
  if (sync.status === 'loading' && !sync.loadedOnce) {
    return { tone: 'var(--color-warn)', text: 'Loading…' }
  }
  if (sync.status === 'error') {
    return { tone: 'var(--color-danger)', text: sync.lastError?.message ?? 'Failed' }
  }
  if (!sync.lastSyncedAt) {
    return { tone: 'var(--color-ink-faint)', text: 'Not synced' }
  }
  return { tone: 'var(--color-ok)', text: `Synced ${ago(sync.lastSyncedAt)}` }
}

export function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Re-render on a timer so relative timestamps do not go stale on screen. */
function useTicker(ms: number): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return n
}
