import type { RecordMeta } from '../../sync/types.ts'

export interface Note extends RecordMeta {
  title: string
  body: string
}

/**
 * Records come from a public repo two people hand-edit, so a bad file is a
 * typo, not an attack. Drop it with a warning rather than taking the app down.
 */
export function parseNote(raw: unknown, path: string): Note | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.title !== 'string') {
    console.warn(`[scratchpad] skipping malformed note: ${path}`)
    return null
  }
  return {
    id: r.id,
    schemaVersion: typeof r.schemaVersion === 'number' ? r.schemaVersion : 1,
    title: r.title,
    body: typeof r.body === 'string' ? r.body : '',
    createdAt: String(r.createdAt ?? ''),
    createdBy: String(r.createdBy ?? 'unknown'),
    updatedAt: String(r.updatedAt ?? ''),
    updatedBy: String(r.updatedBy ?? 'unknown'),
  }
}
