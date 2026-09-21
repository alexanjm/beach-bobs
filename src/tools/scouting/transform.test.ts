import { describe, expect, it } from 'vitest'
import {
  defaultTransform,
  gpsToPixel,
  leafletToPixel,
  pixelToGps,
  pixelToLeaflet,
  solveTransform,
  withinBounds,
  type MapGeometry,
} from './transform.ts'

/*
  Reference points are the load-bearing part of these tests. The 0-100 case is
  every official map; the padded case is what calibration exists for; the
  round-trip cases are the invariant the UI depends on.
*/

const SIZE = 2048

function standardMap(): MapGeometry {
  return {
    width: SIZE,
    height: SIZE,
    gpsPrecision: 1,
    transform: defaultTransform(SIZE, SIZE),
  }
}

/** An export with 128px of ocean padding on every side. */
function paddedMap(): MapGeometry {
  const pad = 128
  const playable = SIZE - pad * 2
  return {
    width: SIZE,
    height: SIZE,
    gpsPrecision: 1,
    transform: {
      lonToX: { scale: playable / 100, offset: pad },
      latToY: { scale: playable / 100, offset: pad },
    },
  }
}

describe('defaultTransform — GPS 0-100 spans the image', () => {
  const map = standardMap()

  it('puts GPS 0,0 at the top-left pixel', () => {
    expect(gpsToPixel(map, { lat: 0, lon: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('puts GPS 100,100 at the bottom-right pixel', () => {
    expect(gpsToPixel(map, { lat: 100, lon: 100 })).toEqual({
      x: SIZE,
      y: SIZE,
    })
  })

  it('puts GPS 50,50 dead centre', () => {
    expect(gpsToPixel(map, { lat: 50, lon: 50 })).toEqual({
      x: SIZE / 2,
      y: SIZE / 2,
    })
  })

  it('keeps lat on the vertical axis and lon on the horizontal one', () => {
    // The axis swap is the classic bug: lat is north-south, so it drives y.
    const north = gpsToPixel(map, { lat: 10, lon: 50 })
    const east = gpsToPixel(map, { lat: 50, lon: 90 })
    expect(north.y).toBeLessThan(east.y)
    expect(east.x).toBeGreaterThan(north.x)
  })

  it('handles a non-square image', () => {
    const wide: MapGeometry = {
      width: 4096,
      height: 2048,
      gpsPrecision: 1,
      transform: defaultTransform(4096, 2048),
    }
    expect(gpsToPixel(wide, { lat: 50, lon: 50 })).toEqual({ x: 2048, y: 1024 })
  })
})

describe('round trips', () => {
  const cases: Array<{ lat: number; lon: number }> = [
    { lat: 0, lon: 0 },
    { lat: 50, lon: 50 },
    { lat: 100, lon: 100 },
    { lat: 43.2, lon: 71.8 },
    { lat: 12.7, lon: 3.4 },
    { lat: 99.9, lon: 0.1 },
    { lat: 66.6, lon: 33.3 },
    { lat: 7.1, lon: 88.8 },
  ]

  for (const map of [standardMap(), paddedMap()]) {
    const kind = map.transform.lonToX.offset === 0 ? 'standard' : 'padded'

    it(`GPS -> pixel -> GPS is exact at HUD precision (${kind})`, () => {
      for (const gps of cases) {
        expect(pixelToGps(map, gpsToPixel(map, gps))).toEqual(gps)
      }
    })

    /*
      A click cannot survive this round trip exactly, and that is correct
      rather than a bug: the GPS we store is rounded to what the HUD shows, so
      a pixel snaps to the nearest 0.1 GPS. One HUD step is `scale` pixels
      wide, so the worst case is half a step — about 1px on a 2048 image, not
      the half-pixel I originally claimed.
    */
    it(`pixel -> GPS -> pixel lands within half a HUD step (${kind})`, () => {
      const stepX = map.transform.lonToX.scale / 10
      const stepY = map.transform.latToY.scale / 10
      for (let x = 0; x <= map.width; x += 97) {
        for (let y = 0; y <= map.height; y += 89) {
          const back = gpsToPixel(map, pixelToGps(map, { x, y }))
          expect(Math.abs(back.x - x)).toBeLessThanOrEqual(stepX / 2 + 1e-9)
          expect(Math.abs(back.y - y)).toBeLessThanOrEqual(stepY / 2 + 1e-9)
        }
      }
    })

    it(`a half-step is small enough to be invisible on screen (${kind})`, () => {
      // Sanity bound on the bound: if this ever exceeds a few pixels, the map
      // image is too small for the precision the HUD gives us.
      expect(map.transform.lonToX.scale / 20).toBeLessThan(2)
    })
  }

  it('rounds a click to a number you could have typed off the HUD', () => {
    const map = standardMap()
    // 1234px / 20.48 = 60.2539..., which the HUD would show as 60.3
    expect(pixelToGps(map, { x: 1234, y: 1234 })).toEqual({
      lat: 60.3,
      lon: 60.3,
    })
  })

  it('rounds half away from zero rather than to even', () => {
    const map: MapGeometry = {
      width: 100,
      height: 100,
      gpsPrecision: 1,
      transform: { lonToX: { scale: 1, offset: 0 }, latToY: { scale: 1, offset: 0 } },
    }
    expect(pixelToGps(map, { x: 0.25, y: 0.35 })).toEqual({ lat: 0.4, lon: 0.3 })
  })
})

describe('solveTransform', () => {
  it('reproduces the reference points it was solved from', () => {
    const a = { lat: 10, lon: 10, x: 204.8, y: 204.8 }
    const b = { lat: 90, lon: 90, x: 1843.2, y: 1843.2 }
    const map: MapGeometry = {
      width: SIZE,
      height: SIZE,
      gpsPrecision: 1,
      transform: solveTransform(a, b),
    }

    expect(gpsToPixel(map, a)).toEqual({ x: a.x, y: a.y })
    expect(gpsToPixel(map, b)).toEqual({ x: b.x, y: b.y })
  })

  it('recovers the 0-100 transform from two interior points', () => {
    const solved = solveTransform(
      { lat: 25, lon: 25, x: 512, y: 512 },
      { lat: 75, lon: 75, x: 1536, y: 1536 },
    )
    expect(solved.lonToX.scale).toBeCloseTo(SIZE / 100, 10)
    expect(solved.lonToX.offset).toBeCloseTo(0, 10)
    expect(solved.latToY.scale).toBeCloseTo(SIZE / 100, 10)
    expect(solved.latToY.offset).toBeCloseTo(0, 10)
  })

  it('recovers a padded image transform', () => {
    const truth = paddedMap()
    const a = { lat: 20, lon: 20, ...gpsToPixel(truth, { lat: 20, lon: 20 }) }
    const b = { lat: 80, lon: 80, ...gpsToPixel(truth, { lat: 80, lon: 80 }) }
    const solved = solveTransform(a, b)

    expect(solved.lonToX.scale).toBeCloseTo(truth.transform.lonToX.scale, 10)
    expect(solved.lonToX.offset).toBeCloseTo(truth.transform.lonToX.offset, 10)
  })

  it('solves axes independently, so a stretched image still works', () => {
    const solved = solveTransform(
      { lat: 0, lon: 0, x: 0, y: 0 },
      { lat: 100, lon: 100, x: 4096, y: 2048 },
    )
    expect(solved.lonToX.scale).toBeCloseTo(40.96, 10)
    expect(solved.latToY.scale).toBeCloseTo(20.48, 10)
  })

  it('refuses two points that share a lon', () => {
    expect(() =>
      solveTransform(
        { lat: 10, lon: 50, x: 100, y: 100 },
        { lat: 90, lon: 50, x: 100, y: 900 },
      ),
    ).toThrow(/lon/)
  })

  it('refuses two points that share a lat', () => {
    expect(() =>
      solveTransform(
        { lat: 50, lon: 10, x: 100, y: 100 },
        { lat: 50, lon: 90, x: 900, y: 100 },
      ),
    ).toThrow(/lat/)
  })
})

describe('leaflet coordinates', () => {
  const map = standardMap()

  it('flips the vertical axis, because CRS.Simple counts y upward', () => {
    expect(pixelToLeaflet(map, { x: 0, y: 0 })).toEqual([SIZE, 0])
    expect(pixelToLeaflet(map, { x: 0, y: SIZE })).toEqual([0, 0])
  })

  it('round-trips', () => {
    const pixel = { x: 123, y: 456 }
    expect(leafletToPixel(map, pixelToLeaflet(map, pixel))).toEqual(pixel)
  })

  it('puts GPS 0,0 at the top of the Leaflet view, as it is in game', () => {
    const [y] = pixelToLeaflet(map, gpsToPixel(map, { lat: 0, lon: 0 }))
    const [ySouth] = pixelToLeaflet(map, gpsToPixel(map, { lat: 100, lon: 0 }))
    expect(y).toBeGreaterThan(ySouth)
  })
})

describe('withinBounds', () => {
  const map = standardMap()

  it('accepts the corners', () => {
    expect(withinBounds(map, { lat: 0, lon: 0 })).toBe(true)
    expect(withinBounds(map, { lat: 100, lon: 100 })).toBe(true)
  })

  it('rejects coordinates off the image', () => {
    expect(withinBounds(map, { lat: -1, lon: 50 })).toBe(false)
    expect(withinBounds(map, { lat: 50, lon: 101 })).toBe(false)
  })
})
