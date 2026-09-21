/*
  ARK GPS <-> image pixel conversion.

  ARK maps are images, not geography. The in-game HUD shows two numbers, lat
  and lon, which are a plain linear remap of world coordinates: lat runs
  north-south, lon runs east-west, and on every official map both run 0 to 100
  across the playable area.

  So the transform is four numbers, not six — x depends only on lon, y only on
  lat. A general affine would allow rotation and shear and would need three
  reference points to solve; no official ARK map is rotated relative to its
  GPS grid, so two points is exactly enough for this form.

  This module is the single most likely thing in the project to be subtly
  wrong, which is why it is pure, has no UI in it, and is tested against known
  reference points before anything draws a marker.
*/

export interface AxisTransform {
  /** pixels per GPS unit */
  scale: number
  /** pixel position of GPS 0 */
  offset: number
}

export interface MapTransform {
  lonToX: AxisTransform
  latToY: AxisTransform
}

export interface Gps {
  lat: number
  lon: number
}

export interface Pixel {
  x: number
  y: number
}

/** A GPS coordinate and the pixel it sits on. Two of these solve a map. */
export interface CalibrationPoint extends Gps, Pixel {}

export interface MapGeometry {
  width: number
  height: number
  transform: MapTransform
  /** Decimal places the in-game HUD shows. Always 1 in practice. */
  gpsPrecision: number
}

/**
 * The assumption that holds for every official map: GPS 0-100 spans exactly
 * the image. Calibration exists for images with border padding, where it
 * doesn't.
 */
export function defaultTransform(width: number, height: number): MapTransform {
  return {
    lonToX: { scale: width / 100, offset: 0 },
    latToY: { scale: height / 100, offset: 0 },
  }
}

export function gpsToPixel(map: MapGeometry, gps: Gps): Pixel {
  return {
    x: gps.lon * map.transform.lonToX.scale + map.transform.lonToX.offset,
    y: gps.lat * map.transform.latToY.scale + map.transform.latToY.offset,
  }
}

/**
 * Inverse of gpsToPixel, rounded to what the HUD can actually display.
 *
 * The rounding is deliberate and is what makes the round trip well defined:
 * a click lands on an arbitrary pixel, but the number we store has to be a
 * number you could have typed off the HUD.
 */
export function pixelToGps(map: MapGeometry, pixel: Pixel): Gps {
  const { lonToX, latToY } = map.transform
  return {
    lat: round((pixel.y - latToY.offset) / latToY.scale, map.gpsPrecision),
    lon: round((pixel.x - lonToX.offset) / lonToX.scale, map.gpsPrecision),
  }
}

/**
 * Solve the transform from two reference points.
 *
 * Pick them far apart — ideally opposite corners. Two points close together
 * make the scale a small difference of large numbers, and the error in it
 * grows across the whole map.
 */
export function solveTransform(
  a: CalibrationPoint,
  b: CalibrationPoint,
): MapTransform {
  return {
    lonToX: solveAxis(a.lon, a.x, b.lon, b.x, 'lon'),
    latToY: solveAxis(a.lat, a.y, b.lat, b.y, 'lat'),
  }
}

function solveAxis(
  gpsA: number,
  pxA: number,
  gpsB: number,
  pxB: number,
  axis: string,
): AxisTransform {
  const span = gpsB - gpsA
  if (span === 0) {
    throw new Error(
      `Cannot solve ${axis}: both reference points have ${axis} ${gpsA}. Pick points that differ on both axes.`,
    )
  }
  const scale = (pxB - pxA) / span
  return { scale, offset: pxA - gpsA * scale }
}

/**
 * Leaflet's CRS.Simple puts the origin at the bottom left with y increasing
 * upward; image pixels count downward from the top. The flip lives here, in
 * one place, so map configs stay in plain image-pixel coordinates that a
 * person can read off an image editor.
 *
 * Returns [y, x] — Leaflet's LatLng argument order for CRS.Simple.
 */
export function pixelToLeaflet(map: MapGeometry, pixel: Pixel): [number, number] {
  return [map.height - pixel.y, pixel.x]
}

export function leafletToPixel(
  map: MapGeometry,
  point: [number, number],
): Pixel {
  return { x: point[1], y: map.height - point[0] }
}

/** True when a GPS coordinate lands inside the image. */
export function withinBounds(map: MapGeometry, gps: Gps): boolean {
  const { x, y } = gpsToPixel(map, gps)
  return x >= 0 && x <= map.width && y >= 0 && y <= map.height
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  // Scale-round-unscale rather than toFixed: toFixed returns a string and
  // rounds half-to-even in some engines.
  return Math.round(value * factor + Number.EPSILON * Math.sign(value)) / factor
}
