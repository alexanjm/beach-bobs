import { useMemo, useState } from 'react'
import { dismissConflict, resolveConflict, useSync } from '../sync/store.ts'
import type { Conflict, StoredRecord } from '../sync/types.ts'
import { Button } from '../ui/Button.tsx'
import { ago } from './SyncBadge.tsx'

/*
  Someone else wrote this record after we last read it. Show both versions and
  let a person choose, field by field if they want. Never silently clobber
  their edit, never silently drop mine.
*/

const META_KEYS = new Set([
  'id',
  'schemaVersion',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
])

export function ConflictDialog() {
  const { conflict } = useSync()
  if (!conflict) return null
  return <Dialog key={conflict.path} conflict={conflict} />
}

function Dialog({ conflict }: { conflict: Conflict }) {
  const fields = useMemo(() => diffFields(conflict), [conflict])
  const [picks, setPicks] = useState<Record<string, 'mine' | 'theirs'>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, 'mine' as const])),
  )
  const [busy, setBusy] = useState(false)

  async function commit(choice: 'theirs' | StoredRecord) {
    setBusy(true)
    await resolveConflict(choice)
    setBusy(false)
  }

  const merged = (): StoredRecord => {
    const base = { ...(conflict.theirs ?? {}) } as StoredRecord
    for (const f of fields) {
      const value = picks[f.key] === 'mine' ? f.mine : f.theirs
      if (value === undefined) delete base[f.key]
      else base[f.key] = value
    }
    return { ...base, id: conflict.id }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-panel bg-surface ring-1 ring-line">
        <header className="border-b border-line-soft px-5 py-4">
          <h2 className="text-sm font-medium text-ink">
            {conflict.theirs
              ? 'This record changed on GitHub'
              : 'This record was deleted on GitHub'}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {conflict.theirs
              ? `${conflict.theirs.updatedBy} saved it ${ago(conflict.theirs.updatedAt)}. Your version is not lost — pick what to keep.`
              : 'Your version is not lost. Saving it again will recreate the record.'}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {fields.length === 0 ? (
            <p className="text-xs text-ink-muted">
              No field differences — only the timestamps moved.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="label-eyebrow">
                  <th className="pb-2 font-normal">Field</th>
                  <th className="pb-2 font-normal">Yours</th>
                  <th className="pb-2 font-normal">
                    {conflict.theirs?.updatedBy ?? 'GitHub'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key} className="border-t border-line-soft align-top">
                    <td className="py-2 pr-3 font-mono text-ink-muted">{f.key}</td>
                    <Cell
                      value={f.mine}
                      selected={picks[f.key] === 'mine'}
                      onSelect={() => setPicks((p) => ({ ...p, [f.key]: 'mine' }))}
                    />
                    <Cell
                      value={f.theirs}
                      selected={picks[f.key] === 'theirs'}
                      onSelect={() => setPicks((p) => ({ ...p, [f.key]: 'theirs' }))}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
          <Button variant="ghost" onClick={dismissConflict} disabled={busy}>
            Decide later
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={busy || !conflict.theirs}
              onClick={() => void commit('theirs')}
            >
              Discard mine
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void commit(merged())}
            >
              {busy ? 'Saving…' : 'Save selection'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Cell({
  value,
  selected,
  onSelect,
}: {
  value: unknown
  selected: boolean
  onSelect: () => void
}) {
  return (
    <td className="py-1 pr-3">
      <button
        onClick={onSelect}
        className={[
          'w-full rounded-control px-2 py-1.5 text-left transition-colors',
          selected
            ? 'bg-accent-dim text-ink ring-1 ring-accent ring-inset'
            : 'bg-surface-2 text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        {format(value)}
      </button>
    </td>
  )
}

function format(value: unknown): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value || '(empty)'
  return JSON.stringify(value)
}

interface FieldDiff {
  key: string
  mine: unknown
  theirs: unknown
}

function diffFields(conflict: Conflict): FieldDiff[] {
  const mine = conflict.mine ?? {}
  const theirs = conflict.theirs ?? {}
  const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])]
    .filter((k) => !META_KEYS.has(k))
    .sort()

  return keys
    .map((key) => ({
      key,
      mine: (mine as Record<string, unknown>)[key],
      theirs: (theirs as Record<string, unknown>)[key],
    }))
    .filter((f) => JSON.stringify(f.mine) !== JSON.stringify(f.theirs))
}
