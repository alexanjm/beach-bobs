import { useState } from 'react'
import { ReadOnlyNotice } from '../../shell/ReadOnlyNotice.tsx'
import { hrefFor } from '../../shell/router.ts'
import { useCanWrite } from '../../sync/settings.ts'
import { removeRecord, saveRecord, useRecords } from '../../sync/store.ts'
import { Button } from '../../ui/Button.tsx'
import { Field, Input, Select, Textarea } from '../../ui/Field.tsx'
import { Panel } from '../../ui/Panel.tsx'
import { ScoutingNav } from './ScoutingNav.tsx'
import type { Location, MapConfig, Server } from './types.ts'

export function ServersScreen() {
  const servers = useRecords<Server>('servers')
  const maps = useRecords<MapConfig>('maps')
  const locations = useRecords<Location>('locations')
  const canWrite = useCanWrite()
  const [editing, setEditing] = useState<Server | 'new' | null>(null)

  const mapName = new Map(maps.map((m) => [m.id, m.name]))
  const pins = (serverId: string) =>
    locations.filter((l) => l.serverId === serverId).length

  const sorted = [...servers].sort((a, b) =>
    (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') ||
    a.name.localeCompare(b.name),
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <ScoutingNav />
      <ReadOnlyNotice />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          {servers.length} server{servers.length === 1 ? '' : 's'} scouted.
        </p>
        {canWrite && editing === null && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            Add server
          </Button>
        )}
      </div>

      {editing !== null && (
        <ServerEditor
          server={editing === 'new' ? null : editing}
          maps={maps}
          onDone={() => setEditing(null)}
        />
      )}

      {sorted.length === 0 && editing === null && (
        <Panel>
          <p className="text-sm text-ink-muted">
            No servers yet.{' '}
            {canWrite
              ? 'Add one, then open it to start dropping pins.'
              : 'Add a token in settings to add one.'}
          </p>
        </Panel>
      )}

      {sorted.map((server) => (
        <Panel key={server.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <a
                href={hrefFor(`/scouting/s/${server.id}`)}
                className="text-sm font-medium text-ink hover:text-accent"
              >
                {server.name}
              </a>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                <span>{mapName.get(server.mapId) ?? 'unknown map'}</span>
                {server.cluster && <span>{server.cluster}</span>}
                <span>
                  {pins(server.id)} pin{pins(server.id) === 1 ? '' : 's'}
                </span>
                {server.lastPlayed && <span>last played {server.lastPlayed}</span>}
              </div>
              {server.notes && (
                <p className="mt-2 text-sm whitespace-pre-wrap text-ink-muted">
                  {server.notes}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-faint">added by {server.createdBy}</p>
            </div>
            <div className="-ml-3 flex shrink-0 gap-1 sm:ml-0">
              <a
                href={hrefFor(`/scouting/s/${server.id}`)}
                className="inline-flex min-h-10 items-center rounded-control px-3 py-1.5 text-sm text-accent transition-colors hover:bg-surface-2 hover:text-accent-hi md:min-h-0"
              >
                Open map
              </a>
              {canWrite && (
                <>
                  <Button variant="ghost" onClick={() => setEditing(server)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${server.name}"? Its ${pins(server.id)} pin(s) stay in the repo but will be orphaned.`,
                        )
                      ) {
                        void removeRecord('servers', server.id)
                      }
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </Panel>
      ))}
    </div>
  )
}

function ServerEditor({
  server,
  maps,
  onDone,
}: {
  server: Server | null
  maps: MapConfig[]
  onDone: () => void
}) {
  const sortedMaps = [...maps].sort((a, b) => a.name.localeCompare(b.name))
  const [name, setName] = useState(server?.name ?? '')
  const [mapId, setMapId] = useState(server?.mapId ?? sortedMaps[0]?.id ?? '')
  const [cluster, setCluster] = useState(server?.cluster ?? '')
  const [lastPlayed, setLastPlayed] = useState(server?.lastPlayed ?? '')
  const [notes, setNotes] = useState(server?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const result = await saveRecord('servers', {
      ...(server ?? {}),
      name: name.trim(),
      mapId,
      cluster: cluster.trim(),
      lastPlayed: lastPlayed || null,
      notes,
    })
    setBusy(false)
    if (result.ok) onDone()
    else if (result.reason !== 'conflict') setError(result.message)
  }

  return (
    <Panel title={server ? 'Edit server' : 'New server'}>
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            placeholder="NA-PVP-TheIsland457"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Map">
            <Select value={mapId} onChange={(e) => setMapId(e.target.value)}>
              {sortedMaps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cluster" hint="Optional">
            <Input
              value={cluster}
              placeholder="NA Official PvP"
              onChange={(e) => setCluster(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Last played" hint="Optional">
          <Input
            type="date"
            value={lastPlayed}
            onChange={(e) => setLastPlayed(e.target.value)}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            rows={3}
            value={notes}
            placeholder="Who's on it, what we're doing there…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={busy || !name.trim() || !mapId}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Panel>
  )
}
