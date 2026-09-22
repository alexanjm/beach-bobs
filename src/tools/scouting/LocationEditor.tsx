import { useState } from 'react'
import { removeRecord, saveRecord } from '../../sync/store.ts'
import { Button } from '../../ui/Button.tsx'
import { Field, Input, Select, Textarea } from '../../ui/Field.tsx'
import { useIsTouch } from '../../ui/useMedia.ts'
import type { Gps } from './transform.ts'
import type { Category, Location } from './types.ts'

/*
  Coordinates are always the two numbers off the in-game HUD. Clicking the map
  fills them in; they stay editable so a coordinate read off a screenshot can
  be typed straight in.
*/

export function LocationEditor({
  serverId,
  location,
  initialGps,
  categories,
  onDone,
}: {
  serverId: string
  location: Location | null
  initialGps: Gps | null
  categories: Category[]
  onDone: () => void
}) {
  const ordered = [...categories].sort((a, b) => a.order - b.order)
  const isTouch = useIsTouch()

  const [title, setTitle] = useState(location?.title ?? '')
  const [categoryId, setCategoryId] = useState(
    location?.categoryId ?? ordered[0]?.id ?? '',
  )
  const [lat, setLat] = useState(
    String(location?.lat ?? initialGps?.lat ?? ''),
  )
  const [lon, setLon] = useState(
    String(location?.lon ?? initialGps?.lon ?? ''),
  )
  const [tags, setTags] = useState((location?.tags ?? []).join(', '))
  const [notes, setNotes] = useState(location?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latNum = Number(lat)
  const lonNum = Number(lon)
  const coordsValid =
    lat.trim() !== '' &&
    lon.trim() !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lonNum)

  async function save() {
    setBusy(true)
    setError(null)
    const result = await saveRecord(
      'locations',
      {
        ...(location ?? {}),
        serverId,
        categoryId,
        lat: latNum,
        lon: lonNum,
        title: title.trim(),
        notes,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      },
      { label: title.trim() || `${latNum}, ${lonNum}` },
    )
    setBusy(false)
    // A failed save keeps the form on screen with everything still typed in.
    if (result.ok) onDone()
    else if (result.reason !== 'conflict') setError(result.message)
  }

  async function remove() {
    if (!location) return
    if (!confirm(`Delete "${location.title || 'this pin'}"?`)) return
    setBusy(true)
    const result = await removeRecord('locations', location.id, {
      label: location.title || location.id,
    })
    setBusy(false)
    if (result.ok) onDone()
    else setError(result.message)
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel bg-surface p-3 ring-1 ring-line-soft">
      <h3 className="label-eyebrow">{location ? 'Edit pin' : 'New pin'}</h3>

      <Field label="Title">
        <Input
          autoFocus={!isTouch}
          value={title}
          placeholder="Red Peak metal run"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field label="Category">
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {ordered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Lat">
          <Input
            inputMode="decimal"
            value={lat}
            placeholder="43.2"
            onChange={(e) => setLat(e.target.value)}
          />
        </Field>
        <Field label="Lon">
          <Input
            inputMode="decimal"
            value={lon}
            placeholder="71.8"
            onChange={(e) => setLon(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Tags" hint="Comma separated">
        <Input
          value={tags}
          placeholder="metal, turrets"
          onChange={(e) => setTags(e.target.value)}
        />
      </Field>

      <Field label="Notes">
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {location ? (
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={busy || !coordsValid || !categoryId}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
