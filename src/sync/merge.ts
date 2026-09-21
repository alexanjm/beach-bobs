import type { IndexFile, OverlayEntry, StoredRecord } from './types.ts'

/*
  Pure merge rules for index + local overlay. Kept separate from the store so
  the tricky part — deciding when a local write has been absorbed by the
  rebuilt index — is testable without faking fetch or localStorage.
*/

export type Overlay = Record<string, OverlayEntry>

/** Index records for one collection, with local writes layered on top. */
export function mergeCollection(
  index: IndexFile,
  overlay: Overlay,
  name: string,
): StoredRecord[] {
  const merged = new Map<string, StoredRecord>()
  for (const [id, entry] of Object.entries(index.collections[name] ?? {})) {
    merged.set(id, entry.record)
  }
  for (const entry of Object.values(overlay)) {
    if (entry.collection !== name) continue
    if (entry.record === null) merged.delete(entry.id)
    else merged.set(entry.id, entry.record)
  }
  return [...merged.values()]
}

export function findRecord(
  index: IndexFile,
  overlay: Overlay,
  collection: string,
  id: string,
  path: string,
): StoredRecord | null {
  const overlaid = overlay[path]
  if (overlaid) return overlaid.record
  return index.collections[collection]?.[id]?.record ?? null
}

/**
 * The sha the next write to this record must carry.
 *
 * Null means "create, do not send a sha": either the record is new, or we
 * deleted it locally and the file is gone, in which case sending the old sha
 * would be rejected.
 */
export function shaFor(
  index: IndexFile,
  overlay: Overlay,
  collection: string,
  id: string,
  path: string,
): string | null {
  const overlaid = overlay[path]
  if (overlaid) return overlaid.record === null ? null : overlaid.sha
  return index.collections[collection]?.[id]?.sha ?? null
}

/**
 * Drop overlay entries the rebuilt index has caught up with.
 *
 * A write is absorbed when the index carries the same blob sha our PUT
 * returned. A delete is absorbed when the record is gone from the index.
 * Anything else stays layered on top — the Action has not run yet.
 */
export function retireOverlay(overlay: Overlay, index: IndexFile): Overlay {
  const next: Overlay = {}
  for (const [path, entry] of Object.entries(overlay)) {
    const indexed = index.collections[entry.collection]?.[entry.id]
    const absorbed =
      entry.record === null ? indexed === undefined : indexed?.sha === entry.sha
    if (!absorbed) next[path] = entry
  }
  return next
}

export function collectionNames(index: IndexFile, overlay: Overlay): string[] {
  return [
    ...new Set([
      ...Object.keys(index.collections),
      ...Object.values(overlay).map((o) => o.collection),
    ]),
  ]
}
