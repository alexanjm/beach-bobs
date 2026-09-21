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
    instance.fitBounds(bounds)

    const fitZoom = instance.getBoundsZoom(bounds)
    instance.setMinZoom(fitZoom - 0.5)
    instance.setMaxZoom(fitZoom + 5)

    mapRef.current = instance
    setMap(instance)

    return () => {
      instance.remove()
      mapRef.current = null
      setMap(null)
    }
  }, [hostRef, size, imageUrl])

  return { map, size, error }
}
