import { useState } from 'react'
import { ReadOnlyNotice } from '../../shell/ReadOnlyNotice.tsx'
import { ago } from '../../shell/SyncBadge.tsx'
import { useCanWrite } from '../../sync/settings.ts'
import { removeRecord, saveRecord, useRecords } from '../../sync/store.ts'
import { Button } from '../../ui/Button.tsx'
import { Panel } from '../../ui/Panel.tsx'
import type { Note } from './types.ts'

const COLLECTION = 'notes'

export function ScratchpadScreen() {
  const notes = useRecords<Note>(COLLECTION)
  const canWrite = useCanWrite()
  const [editing, setEditing] = useState<Note | 'new' | null>(null)

  const sorted = [...notes].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ReadOnlyNotice />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Shared notes. {notes.length} {notes.length === 1 ? 'note' : 'notes'}.
        </p>
        {canWrite && editing === null && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            New note
          </Button>
        )}
      </div>

      {editing !== null && (
        <NoteEditor
          note={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {sorted.length === 0 && editing === null && (
        <Panel>
          <p className="text-sm text-ink-muted">
            Nothing here yet.{' '}
            {canWrite
              ? 'Add a note to prove the whole round trip works.'
              : 'Add a token in settings to write one.'}
          </p>
        </Panel>
      )}

      {sorted.map((note) => (
        <Panel key={note.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-ink">{note.title}</h3>
              {note.body && (
                <p className="mt-1 text-sm whitespace-pre-wrap text-ink-muted">
                  {note.body}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-faint">
                {note.createdBy}
                {note.updatedBy !== note.createdBy && `, edited by ${note.updatedBy}`}
                {note.updatedAt && ` · ${ago(note.updatedAt)}`}
              </p>
            </div>
            {canWrite && (
              <div className="-ml-3 flex shrink-0 gap-1 sm:ml-0">
                <Button variant="ghost" onClick={() => setEditing(note)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void removeRecord(COLLECTION, note.id)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </Panel>
      ))}
    </div>
  )
}

function NoteEditor({
  note,
  onDone,
}: {
  note: Note | null
  onDone: () => void
}) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const result = await saveRecord(COLLECTION, {
      ...(note ?? {}),
      title: title.trim(),
      body,
    })
    setBusy(false)
    // On failure the draft stays on screen — the shell shows retry or the
    // conflict dialog, and nothing typed here is thrown away.
    if (result.ok) onDone()
    else if (result.reason !== 'conflict') setError(result.message)
  }

  return (
    <Panel title={note ? 'Edit note' : 'New note'}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          placeholder="Title"
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-control bg-surface-2 px-3 py-2 text-base md:text-sm text-ink ring-1 ring-line ring-inset outline-none placeholder:text-ink-faint focus:ring-accent"
        />
        <textarea
          value={body}
          rows={4}
          placeholder="Notes…"
          onChange={(e) => setBody(e.target.value)}
          className="resize-y rounded-control bg-surface-2 px-3 py-2 text-base md:text-sm text-ink ring-1 ring-line ring-inset outline-none placeholder:text-ink-faint focus:ring-accent"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={busy || !title.trim()}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Panel>
  )
}
