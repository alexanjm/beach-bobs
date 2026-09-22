import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState, type RefObject } from 'react'

/*
  Shared Leaflet setup for "an image, not geography": CRS.Simple, an image
  overlay, bounds pinned to the image.

  Dimensions come from the image itself rather than from a record, so adding a
  map never involves measuring anything by hand.
*/

export interface ImageSize {
  width: number
  height: number
}

export interface ImageMap {
  map: L.Map | null
  size: ImageSize | null
  error: string | null
}

export function useImageMap(
  hostRef: RefObject<HTMLDivElement | null>,
  imageUrl: string,
): ImageMap {
  const [size, setSize] = useState<ImageSize | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    let cancelled = false
    setSize(null)
    setError(null)

    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      setSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      if (!cancelled) setError(`Could not load ${imageUrl}`)
    }
    img.src = imageUrl

    return () => {
      cancelled = true
    }
  }, [imageUrl])

  useEffect(() => {
    const host = hostRef.current
    if (!size || !host) return

    const bounds = L.latLngBounds([0, 0], [size.height, size.width])
    const instance = L.map(host, {
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomSnap: 0.25,
      maxBounds: bounds.pad(0.2),
      maxBoundsViscosity: 0.75,
    })

    L.imageOverlay(imageUrl, bounds).addTo(instance)

    // Fit the whole image to the container. Runs again on resize, but only
    // while the view is still the fitted one — never yanks away a view the
    // user zoomed or panned into. A zero-size container (not laid out yet)
    // produces a garbage zoom, so it waits for a real size.
    let fittedZoom: number | null = null
    const fit = () => {
      if (host.clientWidth === 0 || host.clientHeight === 0) return
      // getBoundsZoom clamps to the current min zoom (0 by default), and a
      // large image on a small screen needs a negative zoom. Unclamp first.
      instance.setMinZoom(-Infinity)
      const fitZoom = instance.getBoundsZoom(bounds)
      instance.setMinZoom(fitZoom - 0.5)
      instance.setMaxZoom(fitZoom + 5)
      instance.fitBounds(bounds, { animate: false })
      fittedZoom = instance.getZoom()
    }
    fit()

    mapRef.current = instance
    setMap(instance)

    // Leaflet measures its container once. Re-measure whenever the layout
    // moves under it: phone rotation, a sheet opening, the sidebar collapsing.
    const observer = new ResizeObserver(() => {
      instance.invalidateSize({ animate: false })
      if (fittedZoom === null || instance.getZoom() === fittedZoom) fit()
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      instance.remove()
      mapRef.current = null
      setMap(null)
    }
  }, [hostRef, size, imageUrl])

  return { map, size, error }
}
