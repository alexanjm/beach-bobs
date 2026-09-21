import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { resolveGeometry } from './geometry.ts'
import {
  gpsToPixel,
  leafletToPixel,
  pixelToGps,
  pixelToLeaflet,
  type Gps,
  type MapGeometry,
} from './transform.ts'
import type { Category, Location, MapConfig } from './types.ts'

/*
  Leaflet, driven imperatively. No react-leaflet: this is one init effect and
  one marker-sync effect, and going direct keeps full control over marker DOM,
  which the legibility-on-terrain requirement needs.

  ARK maps are images, not geography, so CRS.Simple plus an image overlay.
  Every GPS <-> pixel conversion goes through transform.ts; none of that maths
  is repeated here.
*/

const MARKER_SIZE = 14

export interface MapCanvasProps {
  config: MapConfig
  imageUrl: string
  locations: Location[]
  categoryById: Map<string, Category>
  selectedId: string | null
  draft: Gps | null
  onSelect: (id: string | null) => void
  onMapClick: (gps: Gps) => void
  onHover?: (gps: Gps | null) => void
  onGeometry?: (geometry: MapGeometry) => void
}

export function MapCanvas(props: MapCanvasProps) {
  const {
    config,
    imageUrl,
    locations,
    categoryById,
    selectedId,
    draft,
    onGeometry,
  } = props

  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayer = useRef<L.LayerGroup | null>(null)
  const draftLayer = useRef<L.LayerGroup | null>(null)
  const [geometry, setGeometry] = useState<MapGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Handlers change every render; keep them in a ref so the map is not torn
  // down and rebuilt each time.
  const handlers = useRef(props)
  handlers.current = props

  /* Dimensions come from the image itself, so a map record needs no measuring. */
  useEffect(() => {
    let cancelled = false
    setGeometry(null)
    setError(null)

    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const resolved = resolveGeometry(config, img.naturalWidth, img.naturalHeight)
      setGeometry(resolved)
      onGeometry?.(resolved)
    }
    img.onerror = () => {
      if (!cancelled) setError(`Could not load ${imageUrl}`)
    }
    img.src = imageUrl

    return () => {
      cancelled = true
    }
  }, [config, imageUrl, onGeometry])

  /* Init. Depends only on geometry and the image, so panning state survives
     everything else re-rendering. */
  useEffect(() => {
    const host = hostRef.current
    if (!geometry || !host) return

    const bounds = L.latLngBounds([0, 0], [geometry.height, geometry.width])
    const map = L.map(host, {
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomSnap: 0.25,
      zoomControl: true,
      maxBounds: bounds.pad(0.2),
      maxBoundsViscosity: 0.75,
    })

    L.imageOverlay(imageUrl, bounds).addTo(map)
    map.fitBounds(bounds)

    const fitZoom = map.getBoundsZoom(bounds)
    map.setMinZoom(fitZoom - 0.5)
    map.setMaxZoom(fitZoom + 5)

    markerLayer.current = L.layerGroup().addTo(map)
    draftLayer.current = L.layerGroup().addTo(map)
    mapRef.current = map

    map.on('click', (e: L.LeafletMouseEvent) => {
      const pixel = leafletToPixel(geometry, [e.latlng.lat, e.latlng.lng])
      handlers.current.onMapClick(pixelToGps(geometry, pixel))
    })
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const pixel = leafletToPixel(geometry, [e.latlng.lat, e.latlng.lng])
      handlers.current.onHover?.(pixelToGps(geometry, pixel))
    })
    map.on('mouseout', () => handlers.current.onHover?.(null))

    return () => {
      map.remove()
      mapRef.current = null
      markerLayer.current = null
      draftLayer.current = null
    }
  }, [geometry, imageUrl])

  /* Markers. Rebuilt wholesale — a few hundred pins is nothing, and diffing
     them would be machinery this does not need. */
  useEffect(() => {
    const layer = markerLayer.current
    if (!layer || !geometry) return
    layer.clearLayers()

    for (const location of locations) {
      const category = categoryById.get(location.categoryId)
      const color = `var(--color-${category?.color ?? 'marker-stone'})`
      const selected = location.id === selectedId

      L.marker(pixelToLeaflet(geometry, gpsToPixel(geometry, location)), {
        icon: pinIcon(color, selected),
        keyboard: false,
        title: location.title,
        zIndexOffset: selected ? 1000 : 0,
      })
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          handlers.current.onSelect(location.id)
        })
        .bindTooltip(location.title || '(untitled)', {
          direction: 'top',
          offset: [0, -10],
          className: 'ark-tooltip',
        })
        .addTo(layer)
    }
  }, [locations, categoryById, selectedId, geometry])

  /* The unsaved point, shown while the editor is open. */
  useEffect(() => {
    const layer = draftLayer.current
    if (!layer || !geometry) return
    layer.clearLayers()
    if (!draft) return

    L.marker(pixelToLeaflet(geometry, gpsToPixel(geometry, draft)), {
      icon: pinIcon('var(--color-accent)', true, true),
      interactive: false,
      zIndexOffset: 2000,
    }).addTo(layer)
  }, [draft, geometry])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-panel bg-surface text-sm text-danger">
        {error}
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div ref={hostRef} className="h-full rounded-panel" />
      {!geometry && (
        <div className="absolute inset-0 flex items-center justify-center rounded-panel bg-surface text-sm text-ink-muted">
          Loading map…
        </div>
      )}
    </div>
  )
}

/**
 * Solid fill, dark outline, no translucency — markers have to stay readable
 * against busy terrain, and a see-through pin over jungle is unreadable.
 */
function pinIcon(color: string, selected: boolean, dashed = false): L.DivIcon {
  const ring = selected
    ? 'box-shadow:0 0 0 2px var(--color-accent),0 0 0 4px var(--color-marker-outline);'
    : ''
  const border = dashed
    ? '2px dashed var(--color-marker-outline)'
    : '2px solid var(--color-marker-outline)'

  return L.divIcon({
    className: 'ark-marker',
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    html: `<span style="display:block;width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;border-radius:9999px;background:${color};border:${border};${ring}"></span>`,
  })
}
