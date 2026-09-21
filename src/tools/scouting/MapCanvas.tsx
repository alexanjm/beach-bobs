import L from 'leaflet'
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
import { useImageMap } from './useImageMap.ts'

/*
  Leaflet, driven imperatively. No react-leaflet: this is one marker-sync
  effect on top of the shared image-map hook, and going direct keeps control
  of the marker DOM, which the legibility-on-terrain requirement needs.
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
}

export function MapCanvas(props: MapCanvasProps) {
  const { config, imageUrl, locations, categoryById, selectedId, draft } = props

  const hostRef = useRef<HTMLDivElement>(null)
  const { map, size, error } = useImageMap(hostRef, imageUrl)
  const [geometry, setGeometry] = useState<MapGeometry | null>(null)

  // Handlers change every render; keep them in a ref so the map is not torn
  // down and rebuilt each time.
  const handlers = useRef(props)
  handlers.current = props

  useEffect(() => {
    setGeometry(size ? resolveGeometry(config, size.width, size.height) : null)
  }, [config, size])

  /* Map-level interaction. */
  useEffect(() => {
    if (!map || !geometry) return

    const toGps = (e: L.LeafletMouseEvent) =>
      pixelToGps(geometry, leafletToPixel(geometry, [e.latlng.lat, e.latlng.lng]))

    const onClick = (e: L.LeafletMouseEvent) =>
      handlers.current.onMapClick(toGps(e))
    const onMove = (e: L.LeafletMouseEvent) =>
      handlers.current.onHover?.(toGps(e))
    const onOut = () => handlers.current.onHover?.(null)

    map.on('click', onClick)
    map.on('mousemove', onMove)
    map.on('mouseout', onOut)

    return () => {
      map.off('click', onClick)
      map.off('mousemove', onMove)
      map.off('mouseout', onOut)
    }
  }, [map, geometry])

  /* Markers, rebuilt wholesale — a few hundred pins is nothing, and diffing
     them would be machinery this does not need. */
  useEffect(() => {
    if (!map || !geometry) return
    const layer = L.layerGroup().addTo(map)

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

    return () => {
      layer.remove()
    }
  }, [map, geometry, locations, categoryById, selectedId])

  /* The unsaved point, shown while the editor is open. */
  useEffect(() => {
    if (!map || !geometry || !draft) return
    const marker = L.marker(
      pixelToLeaflet(geometry, gpsToPixel(geometry, draft)),
      {
        icon: pinIcon('var(--color-accent)', true, true),
        interactive: false,
        zIndexOffset: 2000,
      },
    ).addTo(map)

    return () => {
      marker.remove()
    }
  }, [map, geometry, draft])

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
