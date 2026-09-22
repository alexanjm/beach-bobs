import { useState } from 'react'
import { discardFailedWrite, retryWrite, useSync } from '../sync/store.ts'
import { Button } from '../ui/Button.tsx'
import { AlertIcon } from '../ui/icons.tsx'

/*
  A write that failed for something other than a conflict. The change is still
  here and still visible — no offline queue, just a retry button, which covers
  a dropped wifi connection at a tenth of the complexity.
*/

export function FailedWrites() {
  const { failed } = useSync()
  const [busy, setBusy] = useState<string | null>(null)
  if (failed.length === 0) return null

  return (
    <div className="mb-4 flex flex-col gap-2">
      {failed.map((f) => (
        <div
          key={f.path}
          className="flex flex-wrap items-start gap-3 rounded-panel bg-danger-dim px-4 py-3 ring-1 ring-danger/40"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              Could not save{' '}
              <span className="font-mono text-xs text-ink-muted">{f.path}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{f.message}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              disabled={busy === f.path}
              onClick={async () => {
                setBusy(f.path)
                await retryWrite(f.path)
                setBusy(null)
              }}
            >
              {busy === f.path ? 'Retrying…' : 'Retry'}
            </Button>
            <Button variant="ghost" onClick={() => discardFailedWrite(f.path)}>
              Discard
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
