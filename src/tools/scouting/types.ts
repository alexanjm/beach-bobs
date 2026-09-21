import type { RecordMeta } from '../../sync/types.ts'
import type { CalibrationPoint, MapTransform } from './transform.ts'

/*
  Scouting records. Everything here is a data file in the repo, including the
  map list and the category list — adding a map or a category is a record, not
  a code change.
*/

export interface MapConfig extends RecordMeta {
  name: string
  /** Path under public/, e.g. "maps/the-island.jpg". Null until an image lands. */
  image: string | null
  /**
   * Null means "assume GPS 0-100 spans the image", which is true for every
   * official map. Calibration fills this in for images with border padding.
   */
  transform: MapTransform | null
  /** The two points `transform` was solved from, kept so it can be re-solved. */
  calibration: [CalibrationPoint, CalibrationPoint] | null
  notes: string
}

export interface Category extends RecordMeta {
  label: string
  /** A --color-marker-* token name, not a hex value. */
  color: string
  order: number
}

export interface Server extends RecordMeta {
  name: string
  mapId: string
  cluster: string
  notes: string
  /** ISO date, no time. Null if never recorded. */
  lastPlayed: string | null
}

export interface Location extends RecordMeta {
  serverId: string
  categoryId: string
  lat: number
  lon: number
  title: string
  notes: string
  tags: string[]
}

// ——— parsers ————————————————————————————————————————————————————————————
//
// These files are hand-editable in a public repo shared by two people, so a
// malformed record is a typo, not an attack. Drop the record with a warning
// rather than taking the whole app down.

function meta(r: Record<string, unknown>): RecordMeta {
  return {
    id: String(r.id),
    schemaVersion: typeof r.schemaVersion === 'number' ? r.schemaVersion : 1,
    createdAt: String(r.createdAt ?? ''),
    createdBy: String(r.createdBy ?? 'unknown'),
    updatedAt: String(r.updatedAt ?? ''),
    updatedBy: String(r.updatedBy ?? 'unknown'),
  }
}

function object(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null
    ? (raw as Record<string, unknown>)
    : null
}

function warn(kind: string, path: string): null {
  console.warn(`[scouting] skipping malformed ${kind}: ${path}`)
  return null
}

export function parseMapConfig(raw: unknown, path: string): MapConfig | null {
  const r = object(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') {
    return warn('map', path)
  }
  return {
    ...meta(r),
    name: r.name,
    image: typeof r.image === 'string' && r.image ? r.image : null,
    transform: parseTransform(r.transform),
    calibration: parseCalibration(r.calibration),
    notes: typeof r.notes === 'string' ? r.notes : '',
  }
}

function parseTransform(raw: unknown): MapTransform | null {
  const r = object(raw)
  if (!r) return null
  const lon = object(r.lonToX)
  const lat = object(r.latToY)
  if (!lon || !lat) return null
  if (typeof lon.scale !== 'number' || typeof lat.scale !== 'number') return null
  return {
    lonToX: { scale: lon.scale, offset: Number(lon.offset ?? 0) },
    latToY: { scale: lat.scale, offset: Number(lat.offset ?? 0) },
  }
}

function parseCalibration(
  raw: unknown,
): [CalibrationPoint, CalibrationPoint] | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null
  const points = raw.map(object)
  if (points.some((p) => p === null)) return null
  const parsed = (points as Record<string, unknown>[]).map((p) => ({
    lat: Number(p.lat),
    lon: Number(p.lon),
    x: Number(p.x),
    y: Number(p.y),
  }))
  if (parsed.some((p) => Object.values(p).some(Number.isNaN))) return null
  return parsed as [CalibrationPoint, CalibrationPoint]
}

export function parseCategory(raw: unknown, path: string): Category | null {
  const r = object(raw)
  if (!r || typeof r.id !== 'string' || typeof r.label !== 'string') {
    return warn('category', path)
  }
  return {
    ...meta(r),
    label: r.label,
    color: typeof r.color === 'string' ? r.color : 'marker-stone',
    order: typeof r.order === 'number' ? r.order : 999,
  }
}

export function parseServer(raw: unknown, path: string): Server | null {
  const r = object(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') {
    return warn('server', path)
  }
  return {
    ...meta(r),
    name: r.name,
    mapId: String(r.mapId ?? ''),
    cluster: typeof r.cluster === 'string' ? r.cluster : '',
    notes: typeof r.notes === 'string' ? r.notes : '',
    lastPlayed: typeof r.lastPlayed === 'string' ? r.lastPlayed : null,
  }
}

export function parseLocation(raw: unknown, path: string): Location | null {
  const r = object(raw)
  if (
    !r ||
    typeof r.id !== 'string' ||
    typeof r.lat !== 'number' ||
    typeof r.lon !== 'number'
  ) {
    return warn('location', path)
  }
  return {
    ...meta(r),
    serverId: String(r.serverId ?? ''),
    categoryId: String(r.categoryId ?? ''),
    lat: r.lat,
    lon: r.lon,
    title: typeof r.title === 'string' ? r.title : '',
    notes: typeof r.notes === 'string' ? r.notes : '',
    tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === 'string') : [],
  }
}
