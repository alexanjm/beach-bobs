import { useCallback, useMemo, useState } from 'react'
import { assetUrl } from '../../config.ts'
import { useParam } from '../../shell/RouteParams.tsx'
import { ago } from '../../shell/SyncBadge.tsx'
import { hrefFor } from '../../shell/router.ts'
import { useCanWrite } from '../../sync/settings.ts'
import { useRecords } from '../../sync/store.ts'
import { Button } from '../../ui/Button.tsx'
import { Input } from '../../ui/Field.tsx'
import { LocationEditor } from './LocationEditor.tsx'
import { MapCanvas } from './MapCanvas.tsx'
import { PLACEHOLDER_IMAGE } from './geometry.ts'
import type { Gps } from './transform.ts'
import type { Category, Location, MapConfig, Server } from './types.ts'

/*
  One server's map. The height is pinned so the canvas fills the viewport:
  3.5rem of header plus 3rem of shell padding.
*/
const VIEWPORT = 'h-[calc(100dvh-6.5rem)] min-h-[32rem]'

type Draft = { location: Location | null; gps: Gps | null } | null

export function ServerMapScreen() {
  const serverId = useParam('serverId')
  const servers = useRecords<Server>('servers')
  const maps = useRecords<MapConfig>('maps')
  const categories = useRecords<Category>('categories')
  const allLocations = useRecords<Location>('locations')
  const canWrite = useCanWrite()

  const server = servers.find((s) => s.id === serverId) ?? null
  const config = maps.find((m) => m.id === server?.mapId) ?? null

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(null)
  const [hover, setHover] = useState<Gps | null>(null)
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [tag, setTag] = useState<string | null>(null)

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const locations = useMemo(
    () => allLocations.filter((l) => l.serverId === serverId),
    [allLocations, serverId],
  )

  const tags = useMemo(
    () => [...new Set(locations.flatMap((l) => l.tags))].sort(),
    [locations],
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return locations.filter((l) => {
      if (hidden.has(l.categoryId)) return false
      if (tag && !l.tags.includes(tag)) return false
      if (!needle) return true
      return (
        l.title.toLowerCase().includes(needle) ||
        l.notes.toLowerCase().includes(needle)
      )
    })
  }, [locations, hidden, tag, search])

  const onMapClick = useCallback(
    (gps: Gps) => {
      if (!canWrite) return
      setSelectedId(null)
      setDraft({ location: null, gps })
    },
    [canWrite],
  )

  if (!server) {
    return (
      <Missing>
        No server with id <code className="font-mono">{serverId}</code>.
      </Missing>
    )
  }
  if (!config) {
    return (
      <Missing>
        <>
          {server.name} points at map{' '}
          <code className="font-mono">{server.mapId}</code>, which has no record
          in <code className="font-mono">data/maps</code>.
        </>
      </Missing>
    )
  }

  const selected = locations.find((l) => l.id === selectedId) ?? null
  const usingPlaceholder = !config.image

  return (
    <div className={`flex flex-col gap-3 ${VIEWPORT}`}>
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href={hrefFor('/scouting')}
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← Servers
        </a>
        <h2 className="text-sm font-medium text-ink">{server.name}</h2>
        <span className="text-xs text-ink-faint">
          {config.name}
          {server.cluster && ` · ${server.cluster}`} · {locations.length} pin
          {locations.length === 1 ? '' : 's'}
        </span>
        <span className="ml-auto font-mono text-xs text-ink-faint">
          {hover
            ? `lat ${hover.lat.toFixed(1)}  lon ${hover.lon.toFixed(1)}`
            : canWrite
              ? 'click the map to drop a pin'
              : 'read-only'}
        </span>
      </header>

      {usingPlaceholder && (
        <p className="shrink-0 rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-muted">
          No image for {config.name} yet — this is a coordinate grid, and pins
          land at the right GPS on it. Drop{' '}
          <code className="font-mono">public/maps/{config.id}.jpg</code> in and
          set the record's <code className="font-mono">image</code> field.
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-hidden rounded-panel ring-1 ring-line-soft">
          <MapCanvas
            config={config}
            imageUrl={assetUrl(config.image ?? PLACEHOLDER_IMAGE)}
            locations={visible}
            categoryById={categoryById}
            selectedId={selectedId}
            draft={draft?.gps ?? null}
            onSelect={(id) => {
              setSelectedId(id)
              setDraft(null)
            }}
            onMapClick={onMapClick}
            onHover={setHover}
          />
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
          {draft ? (
            <LocationEditor
              serverId={server.id}
              location={draft.location}
              initialGps={draft.gps}
              categories={categories}
              onDone={() => setDraft(null)}
            />
          ) : (
            <>
              <Filters
                search={search}
                setSearch={setSearch}
                categories={categories}
                hidden={hidden}
                setHidden={setHidden}
                tags={tags}
                tag={tag}
                setTag={setTag}
                canAdd={canWrite}
                onAdd={() => setDraft({ location: null, gps: null })}
              />

              {selected && (
                <Detail
                  location={selected}
                  category={categoryById.get(selected.categoryId) ?? null}
                  canWrite={canWrite}
                  onEdit={() =>
                    setDraft({ location: selected, gps: null })
                  }
                  onClose={() => setSelectedId(null)}
                />
              )}

              <LocationList
                locations={visible}
                categoryById={categoryById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                total={locations.length}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function Filters({
  search,
  setSearch,
  categories,
  hidden,
  setHidden,
  tags,
  tag,
  setTag,
  canAdd,
  onAdd,
}: {
  search: string
  setSearch: (v: string) => void
  categories: Category[]
  hidden: Set<string>
  setHidden: (v: Set<string>) => void
  tags: string[]
  tag: string | null
  setTag: (v: string | null) => void
  canAdd: boolean
  onAdd: () => void
}) {
  function toggle(id: string) {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel bg-surface p-3 ring-1 ring-line-soft">
      <div className="flex gap-2">
        <Input
          value={search}
          placeholder="Search titles and notes…"
          onChange={(e) => setSearch(e.target.value)}
        />
        {canAdd && (
          <Button variant="primary" onClick={onAdd} title="Add a pin by typing GPS">
            +
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...categories]
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const on = !hidden.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs transition-colors',
                  on
                    ? 'bg-surface-3 text-ink'
                    : 'bg-surface-2 text-ink-faint line-through',
                ].join(' ')}
              >
                <span
                  className="size-2 rounded-full"
                  style={{
                    background: on
                      ? `var(--color-${c.color})`
                      : 'var(--color-ink-faint)',
                  }}
                />
                {c.label}
              </button>
            )
          })}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={[
                'rounded-control px-2 py-0.5 text-xs transition-colors',
                tag === t
                  ? 'bg-accent text-accent-ink'
                  : 'bg-surface-2 text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LocationList({
  locations,
  categoryById,
  selectedId,
  onSelect,
  total,
}: {
  locations: Location[]
  categoryById: Map<string, Category>
  selectedId: string | null
  onSelect: (id: string) => void
  total: number
}) {
  const sorted = [...locations].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  )

  return (
    <div className="flex flex-col gap-1 rounded-panel bg-surface p-3 ring-1 ring-line-soft">
      <div className="label-eyebrow mb-1">
        {locations.length === total
          ? `${total} pin${total === 1 ? '' : 's'}`
          : `${locations.length} of ${total}`}
      </div>
      {sorted.length === 0 && (
        <p className="text-xs text-ink-faint">Nothing matches.</p>
      )}
      {sorted.map((l) => {
        const category = categoryById.get(l.categoryId)
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={[
              'flex items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs transition-colors',
              l.id === selectedId
                ? 'bg-surface-3 text-ink'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            ].join(' ')}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                background: `var(--color-${category?.color ?? 'marker-stone'})`,
                border: '1.5px solid var(--color-marker-outline)',
              }}
            />
            <span className="min-w-0 flex-1 truncate">
              {l.title || '(untitled)'}
            </span>
            <span className="shrink-0 font-mono text-ink-faint">
              {l.lat.toFixed(1)}, {l.lon.toFixed(1)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Detail({
  location,
  category,
  canWrite,
  onEdit,
  onClose,
}: {
  location: Location
  category: Category | null
  canWrite: boolean
  onEdit: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-panel bg-surface p-3 ring-1 ring-line-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink">
            {location.title || '(untitled)'}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-ink-faint">
            lat {location.lat.toFixed(1)} lon {location.lon.toFixed(1)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-control px-2 text-ink-faint hover:text-ink"
        >
          ✕
        </button>
      </div>

      {category && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-control bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
          <span
            className="size-2 rounded-full"
            style={{ background: `var(--color-${category.color})` }}
          />
          {category.label}
        </span>
      )}

      {location.notes && (
        <p className="text-xs whitespace-pre-wrap text-ink-muted">
          {location.notes}
        </p>
      )}

      {location.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {location.tags.map((t) => (
            <span
              key={t}
              className="rounded-control bg-surface-2 px-1.5 py-0.5 text-xs text-ink-muted"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-faint">
        {location.createdBy}
        {location.updatedBy !== location.createdBy &&
          `, edited by ${location.updatedBy}`}
        {location.updatedAt && ` · ${ago(location.updatedAt)}`}
      </p>

      {canWrite && (
        <Button variant="secondary" onClick={onEdit} className="w-fit">
          Edit
        </Button>
      )}
    </div>
  )
}

function Missing({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-sm text-ink-muted">
      {children}{' '}
      <a href={hrefFor('/scouting')} className="text-accent hover:text-accent-hi">
        Back to servers
      </a>
    </div>
  )
}
