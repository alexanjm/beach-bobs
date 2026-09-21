/** Fields every record in every collection carries. */
export interface RecordMeta {
  id: string
  schemaVersion: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export type StoredRecord = RecordMeta & Record<string, unknown>

/**
 * One record as it appears in the generated index. The sha is the git blob
 * sha of the record file, which is exactly what the Contents API wants back
 * when updating it — so the app gets every sha it needs from one fetch
 * instead of one API call per record.
 */
export interface IndexEntry {
  record: StoredRecord
  sha: string
}

export interface IndexFile {
  generatedAt: string
  commit: string
  collections: Record<string, Record<string, IndexEntry>>
}

export const EMPTY_INDEX: IndexFile = {
  generatedAt: '',
  commit: '',
  collections: {},
}

/**
 * A local write that has landed on GitHub but has not yet appeared in the
 * generated index — the rebuild Action takes ~30s. Without this the record
 * you just saved would vanish on the next refresh.
 */
export interface OverlayEntry {
  path: string
  collection: string
  id: string
  /** null means deleted locally. */
  record: StoredRecord | null
  sha: string
}

/** A write that failed for a reason that is not a conflict. Retryable. */
export interface FailedWrite {
  path: string
  collection: string
  id: string
  record: StoredRecord | null
  message: string
}

/** A write rejected because someone else moved the file first. */
export interface Conflict {
  path: string
  collection: string
  id: string
  mine: StoredRecord | null
  theirs: StoredRecord | null
  theirSha: string
}

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'error'
