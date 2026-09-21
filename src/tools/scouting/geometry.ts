import {
  defaultTransform,
  solveTransform,
  type MapGeometry,
} from './transform.ts'
import type { MapConfig } from './types.ts'

/*
  Turning a stored map record plus a loaded image into something the transform
  functions can use.

  Dimensions come from the image itself rather than the record, so adding a
  map is: drop a jpg in public/maps, add a record with an id, a name and the
  image path. Nothing to measure by hand and nothing to keep in sync.
*/

export const GPS_PRECISION = 1

/**
 * Stand-in for a map with no image yet: a labelled GPS grid. Pins land at
 * their true coordinates on it, so the whole tool is usable — and the
 * transform is visibly verifiable — before any real imagery arrives.
 */
export const PLACEHOLDER_IMAGE = 'maps/placeholder-grid.svg'

export function resolveGeometry(
  config: MapConfig,
  naturalWidth: number,
  naturalHeight: number,
): MapGeometry {
  return {
    width: naturalWidth,
    height: naturalHeight,
    gpsPrecision: GPS_PRECISION,
    transform:
      config.calibration
        ? solveTransform(config.calibration[0], config.calibration[1])
        : (config.transform ?? defaultTransform(naturalWidth, naturalHeight)),
  }
}

/** How this map's transform was arrived at, for the calibration screen. */
export function transformSource(
  config: MapConfig,
): 'calibrated' | 'stored' | 'assumed' {
  if (config.calibration) return 'calibrated'
  if (config.transform) return 'stored'
  return 'assumed'
}
