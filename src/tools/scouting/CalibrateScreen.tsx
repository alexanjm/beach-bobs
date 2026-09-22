import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { assetUrl } from '../../config.ts'
import { ReadOnlyNotice } from '../../shell/ReadOnlyNotice.tsx'
import { useParam } from '../../shell/RouteParams.tsx'
import { hrefFor } from '../../shell/router.ts'
import { useCanWrite } from '../../sync/settings.ts'
import { saveRecord, useRecords } from '../../sync/store.ts'
import { Button } from '../../ui/Button.tsx'
import { Input } from '../../ui/Field.tsx'
import { GPS_PRECISION, PLACEHOLDER_IMAGE, transformSource } from './geometry.ts'
import {
  defaultTransform,
  gpsToPixel,
  leafletToPixel,
  pixelToLeaflet,
  solveTransform,
  type CalibrationPoint,
  type MapGeometry,
} from './transform.ts'
import type { MapConfig } from './types.ts'
import { useImageMap } from './useImageMap.ts'

/*
  Solving a map's transform by pointing at two things you know the GPS of.

  The grid overlay is the point of this screen: it draws GPS lines every ten
  units using whatever transform is currently in effect, so a wrong transform
  is visible rather than something you discover later when a pin is in the
  sea.
*/

const VIEWPORT = 'md:h-[calc(100dvh-6.5rem)] md:min-h-[32rem]'
const GRID_STEP = 10

interface PointDraft {
  x: number | null
  y: number | null
  lat: string
  lon: string
}

const EMPTY: PointDraft = { x: null, y: null, lat: '', lon: '' }

export function CalibrateScreen() {
  const mapId = useParam('mapId')
  const maps = useRecords<MapConfig>('maps')
  const canWrite = useCanWrite()
  const config = maps.find((m) => m.id === mapId) ?? null

  const hostRef = useRef<HTMLDivElement>(null)
  const imageUrl = assetUrl(config?.image ?? PLACEHOLDER_IMAGE)
  const { map, size, error } = useImageMap(hostRef, imageUrl)

  const [points, setPoints] = useState<[PointDraft, PointDraft]>(() => [
    EMPTY,
    EMPTY,
  ])
  const [active, setActive] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /* Seed from whatever the record was last calibrated with. */
  useEffect(() => {
    if (!config?.calibration) return
    setPoints(
      config.calibration.map((p) => ({
        x: p.x,
        y: p.y,
        lat: String(p.lat),
        lon: String(p.lon),
      })) as [PointDraft, PointDraft],
    )
  }, [config])

  const solved = useMemo(() => solve(points), [points])

  const geometry: MapGeometry | null = useMemo(() => {
    if (!size) return null
    return {
      width: size.width,
      height: size.height,
      gpsPrecision: GPS_PRECISION,
      transform:
        solved.transform ??
        config?.transform ??
        defaultTransform(size.width, size.height),
    }
  }, [size, solved.transform, config])

  /* Clicking the map fills in the active point's pixel. */
  useEffect(() => {
    if (!map || !geometry) return
    const onClick = (e: L.LeafletMouseEvent) => {
      const pixel = leafletToPixel(geometry, [e.latlng.lat, e.latlng.lng])
      setPoints((prev) => {
        const next = [...prev] as [PointDraft, PointDraft]
        next[active] = { ...next[active]!, x: pixel.x, y: pixel.y }
        return next
      })
      setActive((a) => (points[a === 0 ? 1 : 0]!.x === null ? (a === 0 ? 1 : 0) : a))
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [map, geometry, active, points])

  /* The two reference markers. */
  useEffect(() => {
    if (!map || !geometry) return
    const layer = L.layerGroup().addTo(map)
    points.forEach((p, i) => {
      if (p.x === null || p.y === null) return
      L.marker(pixelToLeaflet(geometry, { x: p.x, y: p.y }), {
        icon: L.divIcon({
          className: 'ark-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: `<span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:9999px;background:var(--color-accent);border:2px solid var(--color-marker-outline);color:var(--color-accent-ink);font:600 11px/1 ui-sans-serif,system-ui">${i === 0 ? 'A' : 'B'}</span>`,
        }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(layer)
    })
    return () => {
      layer.remove()
    }
  }, [map, geometry, points])

  /* The GPS grid, drawn with the transform currently in effect. */
  useEffect(() => {
    if (!map || !geometry || !showGrid) return
    const layer = L.layerGroup().addTo(map)

    for (let v = 0; v <= 100; v += GRID_STEP) {
      const major = v === 0 || v === 100 || v === 50
      const style = {
        color: major ? 'var(--color-tek)' : 'var(--color-accent)',
        weight: major ? 1.5 : 1,
        opacity: major ? 0.9 : 0.45,
        interactive: false,
      }
      // constant lon -> vertical line; constant lat -> horizontal line
      L.polyline(
        [
          pixelToLeaflet(geometry, gpsToPixel(geometry, { lat: 0, lon: v })),
          pixelToLeaflet(geometry, gpsToPixel(geometry, { lat: 100, lon: v })),
        ],
        style,
      ).addTo(layer)
      L.polyline(
        [
          pixelToLeaflet(geometry, gpsToPixel(geometry, { lat: v, lon: 0 })),
          pixelToLeaflet(geometry, gpsToPixel(geometry, { lat: v, lon: 100 })),
        ],
        style,
      ).addTo(layer)
    }

    return () => {
      layer.remove()
    }
  }, [map, geometry, showGrid])

  if (!config) {
    return (
      <p className="text-sm text-ink-muted">
        No map with id <code className="font-mono">{mapId}</code>.{' '}
        <a href={hrefFor('/scouting/maps')} className="text-accent">
          Back to maps
        </a>
      </p>
    )
  }

  async function save() {
    if (!solved.points || !solved.transform || !config) return
    setBusy(true)
    setSaveError(null)
    const result = await saveRecord(
      'maps',
      { ...config, calibration: solved.points, transform: solved.transform },
      { label: `calibrate ${config.name}` },
    )
    setBusy(false)
    if (!result.ok && result.reason !== 'conflict') setSaveError(result.message)
  }

  async function reset() {
    if (!config) return
    setBusy(true)
    const result = await saveRecord(
      'maps',
      { ...config, calibration: null, transform: null },
      { label: `reset calibration for ${config.name}` },
    )
    setBusy(false)
    setPoints([EMPTY, EMPTY])
    setActive(0)
    if (!result.ok && result.reason !== 'conflict') setSaveError(result.message)
  }

  return (
    <div className={`flex flex-col gap-3 ${VIEWPORT}`}>
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3">
        <a
          href={hrefFor('/scouting/maps')}
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← Maps
        </a>
        <h2 className="text-sm font-medium text-ink">
          Calibrate {config.name}
        </h2>
        <span className="text-xs text-ink-faint">
          {SOURCE_TEXT[transformSource(config)]}
          {size && ` · ${size.width}×${size.height}px`}
        </span>
        <label className="flex items-center gap-2 py-1 text-xs text-ink-muted md:ml-auto">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          GPS grid
        </label>
      </header>

      <div className="flex flex-col gap-3 md:min-h-0 md:flex-1 md:flex-row">
        <div className="aspect-square max-h-[62dvh] w-full min-w-0 shrink-0 overflow-hidden rounded-panel ring-1 ring-line-soft md:aspect-auto md:h-auto md:max-h-none md:w-auto md:flex-1 md:shrink">
          {error ? (
            <div className="flex h-full items-center justify-center text-sm text-danger">
              {error}
            </div>
          ) : (
            <div ref={hostRef} className="h-full" />
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-3 md:w-80 md:overflow-y-auto">
          <ReadOnlyNotice />

          <div className="rounded-panel bg-surface p-3 text-xs text-ink-muted ring-1 ring-line-soft">
            <p>
              Click a spot on the map you know the real GPS of, then type that
              GPS in. Do it for two spots.
            </p>
            <p className="mt-2 text-ink-faint">
              Pick them far apart — opposite corners beat two points near each
              other, where a small pixel error turns into a large scale error.
              Obelisks are good: their coordinates are fixed and easy to look
              up.
            </p>
          </div>

          {points.map((p, i) => (
            <PointCard
              key={i}
              index={i}
              point={p}
              active={active === i}
              onActivate={() => setActive(i)}
              onChange={(patch) =>
                setPoints((prev) => {
                  const next = [...prev] as [PointDraft, PointDraft]
                  next[i] = { ...next[i]!, ...patch }
                  return next
                })
              }
            />
          ))}

          <div className="rounded-panel bg-surface p-3 ring-1 ring-line-soft">
            <div className="label-eyebrow mb-2">Result</div>
            {solved.error ? (
              <p className="text-xs text-danger">{solved.error}</p>
            ) : solved.transform ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
                <dt className="text-ink-faint">px per lon</dt>
                <dd>{solved.transform.lonToX.scale.toFixed(3)}</dd>
                <dt className="text-ink-faint">lon origin</dt>
                <dd>{solved.transform.lonToX.offset.toFixed(1)}px</dd>
                <dt className="text-ink-faint">px per lat</dt>
                <dd>{solved.transform.latToY.scale.toFixed(3)}</dd>
                <dt className="text-ink-faint">lat origin</dt>
                <dd>{solved.transform.latToY.offset.toFixed(1)}px</dd>
              </dl>
            ) : (
              <p className="text-xs text-ink-faint">
                Set both points to solve. The grid on the map shows the
                transform currently in effect.
              </p>
            )}

            {saveError && (
              <p className="mt-2 text-xs text-danger">{saveError}</p>
            )}

            {canWrite && (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  disabled={busy || !solved.transform}
                  onClick={() => void save()}
                >
                  {busy ? 'Saving…' : 'Save calibration'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || transformSource(config) === 'assumed'}
                  onClick={() => void reset()}
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function PointCard({
  index,
  point,
  active,
  onActivate,
  onChange,
}: {
  index: number
  point: PointDraft
  active: boolean
  onActivate: () => void
  onChange: (patch: Partial<PointDraft>) => void
}) {
  const placed = point.x !== null && point.y !== null
  return (
    <div
      onClick={onActivate}
      className={[
        'flex cursor-pointer flex-col gap-2 rounded-panel p-3 ring-1 transition-colors',
        active ? 'bg-surface-2 ring-accent' : 'bg-surface ring-line-soft',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Point {index === 0 ? 'A' : 'B'}</span>
        <span className="font-mono text-xs text-ink-faint">
          {placed
            ? `${point.x!.toFixed(0)}, ${point.y!.toFixed(0)}px`
            : active
              ? 'click the map'
              : 'not placed'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          inputMode="decimal"
          value={point.lat}
          placeholder="lat"
          onChange={(e) => onChange({ lat: e.target.value })}
        />
        <Input
          inputMode="decimal"
          value={point.lon}
          placeholder="lon"
          onChange={(e) => onChange({ lon: e.target.value })}
        />
      </div>
    </div>
  )
}

const SOURCE_TEXT = {
  assumed: 'currently assuming GPS 0–100 spans the image',
  stored: 'using a stored transform',
  calibrated: 'calibrated',
}

interface Solved {
  points: [CalibrationPoint, CalibrationPoint] | null
  transform: ReturnType<typeof solveTransform> | null
  error: string | null
}

function solve(points: [PointDraft, PointDraft]): Solved {
  const parsed = points.map((p) => {
    const lat = Number(p.lat)
    const lon = Number(p.lon)
    if (
      p.x === null ||
      p.y === null ||
      p.lat.trim() === '' ||
      p.lon.trim() === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return null
    }
    return { x: p.x, y: p.y, lat, lon }
  })

  const [a, b] = parsed
  if (!a || !b) return { points: null, transform: null, error: null }

  try {
    return {
      points: [a, b],
      transform: solveTransform(a, b),
      error: null,
    }
  } catch (err) {
    return {
      points: null,
      transform: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
