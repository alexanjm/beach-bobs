import { assetUrl } from '../../config.ts'
import { useRecords } from '../../sync/store.ts'
import { Panel } from '../../ui/Panel.tsx'
import { transformSource } from './geometry.ts'
import type { Category, MapConfig, Server } from './types.ts'

/*
  Map roster. Every map is a record in data/maps, so adding one is a file, not
  a deploy. A map with no image yet is a normal state, not an error — the
  config lands before the jpg does.
*/

export function MapsScreen() {
  const maps = useRecords<MapConfig>('maps')
  const servers = useRecords<Server>('servers')
  const categories = useRecords<Category>('categories')

  const sorted = [...maps].sort((a, b) => a.name.localeCompare(b.name))
  const withImage = sorted.filter((m) => m.image)
  const serverCount = (mapId: string) =>
    servers.filter((s) => s.mapId === mapId).length

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      {withImage.length === 0 && maps.length > 0 && (
        <div className="rounded-panel bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          No map images yet. Drop them in{' '}
          <code className="font-mono text-xs text-ink">public/maps/</code> named{' '}
          <code className="font-mono text-xs text-ink">&lt;map-id&gt;.jpg</code>,
          then set each record's <code className="font-mono text-xs">image</code>{' '}
          field. Everything else works without them.
        </div>
      )}

      <Panel title={`Maps — ${maps.length}`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((map) => (
            <MapCard key={map.id} map={map} servers={serverCount(map.id)} />
          ))}
        </div>
      </Panel>

      <Panel title={`Categories — ${categories.length}`}>
        <p className="mb-3 text-xs text-ink-faint">
          Marker colour and icon come from these records. Add your own without
          touching code.
        </p>
        <div className="flex flex-wrap gap-2">
          {[...categories]
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-2 rounded-control bg-surface-2 px-2.5 py-1 text-xs text-ink-muted"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    background: `var(--color-${c.color})`,
                    border: '1.5px solid var(--color-marker-outline)',
                  }}
                />
                {c.label}
              </span>
            ))}
        </div>
      </Panel>
    </div>
  )
}

function MapCard({ map, servers }: { map: MapConfig; servers: number }) {
  const source = transformSource(map)
  return (
    <div className="flex items-center gap-3 rounded-control bg-surface-2 p-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-control bg-surface-3">
        {map.image && (
          <img
            src={assetUrl(map.image)}
            alt=""
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{map.name}</div>
        <div className="mt-0.5 text-xs text-ink-faint">
          {servers > 0
            ? `${servers} server${servers === 1 ? '' : 's'}`
            : 'no servers yet'}
          {' · '}
          {map.image ? SOURCE_LABEL[source] : 'no image'}
        </div>
      </div>
    </div>
  )
}

const SOURCE_LABEL: Record<ReturnType<typeof transformSource>, string> = {
  calibrated: 'calibrated',
  stored: 'custom transform',
  assumed: 'GPS 0–100 assumed',
}
