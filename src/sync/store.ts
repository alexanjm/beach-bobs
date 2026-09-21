import { useMemo, useSyncExternalStore } from 'react'
import { recordPath } from '../config.ts'
import {
  AuthError,
  ConflictError,
  deleteRecord as apiDelete,
  fetchIndex,
  fetchRecord,
  putRecord,
} from './github.ts'
import { getIdentity, getToken } from './settings.ts'
import {
  collectionNames,
  findRecord as findIn,
  mergeCollection as mergeIn,
  retireOverlay as retireIn,
  shaFor as shaIn,
} from './merge.ts'
import {
  EMPTY_INDEX,
  type Conflict,
  type FailedWrite,
  type IndexFile,
  type OverlayEntry,
  type StoredRecord,
  type SyncStatus,
} from './types.ts'

/*
  The dataset lives in memory, mirrors to localStorage so a reload paints from
  cache instead of a blank screen, and is refreshed from the generated index.

  The overlay is the piece that is easy to miss: a write lands on GitHub as a
  commit, but data/index.json is rebuilt by an Action that takes ~30 seconds.
  Between those two moments the index does not contain your record. Without an
  overlay the pin you just dropped disappears on the next refresh and the app
  looks broken to the person who just used it.
*/

const CACHE_KEY = 'arktools.cache.v1'
const FOCUS_THROTTLE_MS = 5_000

export interface SyncError {
  kind: 'auth' | 'network' | 'other'
  message: string
}

interface State {
  index: IndexFile
  overlay: Record<string, OverlayEntry>
  status: SyncStatus
  lastSyncedAt: string | null
  lastError: SyncError | null
  conflict: Conflict | null
  failed: Record<string, FailedWrite>
  /** False until an index has actually loaded this session. */
  loadedOnce: boolean
}

let state: State = {
  index: EMPTY_INDEX,
  overlay: {},
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
  conflict: null,
  failed: {},
  loadedOnce: false,
}

const listeners = new Set<() => void>()

function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  persist()
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ——— cache ————————————————————————————————————————————————————————————

function persist() {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ index: state.index, overlay: state.overlay }),
    )
  } catch {
    // Quota or private mode. The cache is an optimisation, not the truth.
  }
}

function hydrate() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const cached = JSON.parse(raw) as {
      index?: IndexFile
      overlay?: Record<string, OverlayEntry>
    }
    state = {
      ...state,
      index: cached.index ?? EMPTY_INDEX,
      overlay: cached.overlay ?? {},
    }
  } catch {
    // Corrupt cache. Drop it and fetch fresh.
  }
}

// ——— reads ————————————————————————————————————————————————————————————

function mergeCollection(name: string): StoredRecord[] {
  return mergeIn(state.index, state.overlay, name)
}

function findRecord(collection: string, id: string): StoredRecord | null {
  return findIn(state.index, state.overlay, collection, id, recordPath(collection, id))
}

function shaFor(collection: string, id: string): string | null {
  return shaIn(state.index, state.overlay, collection, id, recordPath(collection, id))
}

// ——— refresh ——————————————————————————————————————————————————————————

let inFlight: Promise<void> | null = null
let lastRefreshAt = 0

export function refresh(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    if (state.status !== 'saving') setState({ status: 'loading' })
    try {
      const index = await loadIndex()
      lastRefreshAt = Date.now()
      setState({
        index,
        overlay: retireIn(state.overlay, index),
        status: state.status === 'saving' ? 'saving' : 'idle',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
        loadedOnce: true,
      })
    } catch (err) {
      setState({ status: 'error', lastError: describe(err) })
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Prefer the token path, but the repo is public — if the token is bad, fall
 * back to the anonymous path so a broken token degrades to read-only rather
 * than to a blank app.
 */
async function loadIndex(): Promise<IndexFile> {
  const token = getToken()
  if (!token) return fetchIndex(null)
  try {
    return await fetchIndex(token)
  } catch (err) {
    if (err instanceof AuthError) return fetchIndex(null)
    throw err
  }
}

function describe(err: unknown): SyncError {
  if (err instanceof AuthError) {
    return {
      kind: 'auth',
      message:
        'GitHub rejected the token. It is missing, wrong, or lacks the public_repo scope.',
    }
  }
  if (err instanceof TypeError) {
    return { kind: 'network', message: 'Could not reach GitHub.' }
  }
  return { kind: 'other', message: err instanceof Error ? err.message : String(err) }
}

// ——— writes ———————————————————————————————————————————————————————————

export type SaveResult =
  | { ok: true; record: StoredRecord }
  | { ok: false; reason: 'conflict' | 'auth' | 'error'; message: string }

export interface SaveOptions {
  /** Human-readable name for the commit message. Falls back to title/name/id. */
  label?: string
}

export async function saveRecord(
  collection: string,
  draft: Record<string, unknown> & { id?: string },
  options: SaveOptions = {},
): Promise<SaveResult> {
  const token = getToken()
  const identity = getIdentity()
  if (!token) {
    return { ok: false, reason: 'auth', message: 'No token on this device.' }
  }
  if (!identity) {
    return { ok: false, reason: 'auth', message: 'No display name set.' }
  }

  const id = draft.id ?? crypto.randomUUID()
  const existing = findRecord(collection, id)
  const now = new Date().toISOString()

  const record: StoredRecord = {
    ...draft,
    id,
    schemaVersion: (draft.schemaVersion as number | undefined) ?? 1,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? identity,
    updatedAt: now,
    updatedBy: identity,
  }

  const path = recordPath(collection, id)
  const label = options.label ?? describeRecord(record, id)
  const message = `${existing ? 'update' : 'add'} ${singular(collection)}: ${label} (${identity})`

  setState({ status: 'saving' })
  try {
    const { sha } = await putRecord(token, path, record, shaFor(collection, id), message)
    commitLocally({ path, collection, id, record, sha })
    return { ok: true, record }
  } catch (err) {
    return await handleWriteFailure(err, { path, collection, id, record })
  }
}

export async function removeRecord(
  collection: string,
  id: string,
  options: SaveOptions = {},
): Promise<SaveResult> {
  const token = getToken()
  const identity = getIdentity()
  if (!token || !identity) {
    return { ok: false, reason: 'auth', message: 'No token or display name set.' }
  }

  const existing = findRecord(collection, id)
  const sha = shaFor(collection, id)
  if (!existing || !sha) {
    return { ok: false, reason: 'error', message: 'Nothing to delete.' }
  }

  const path = recordPath(collection, id)
  const label = options.label ?? describeRecord(existing, id)
  const message = `delete ${singular(collection)}: ${label} (${identity})`

  setState({ status: 'saving' })
  try {
    await apiDelete(token, path, sha, message)
    commitLocally({ path, collection, id, record: null, sha })
    return { ok: true, record: existing }
  } catch (err) {
    return await handleWriteFailure(err, { path, collection, id, record: null })
  }
}

function commitLocally(entry: OverlayEntry) {
  const failed = { ...state.failed }
  delete failed[entry.path]
  setState({
    overlay: { ...state.overlay, [entry.path]: entry },
    failed,
    status: 'idle',
    lastError: null,
    conflict: null,
  })
}

async function handleWriteFailure(
  err: unknown,
  attempt: { path: string; collection: string; id: string; record: StoredRecord | null },
): Promise<SaveResult> {
  if (err instanceof ConflictError) {
    // Re-read so we can show both versions rather than guessing.
    let theirs: StoredRecord | null = null
    let theirSha: string | null = null
    try {
      const remote = await fetchRecord(getToken(), attempt.path)
      theirs = remote.record
      theirSha = remote.sha
    } catch {
      // Fall through with what we have; the UI handles a null "theirs".
    }
    setState({
      status: 'error',
      conflict: { ...attempt, mine: attempt.record, theirs, theirSha: theirSha ?? '' },
      lastError: {
        kind: 'other',
        message: 'This record changed on GitHub while you were editing it.',
      },
    })
    return { ok: false, reason: 'conflict', message: 'Changed on GitHub.' }
  }

  const error = describe(err)
  setState({
    status: 'error',
    lastError: error,
    failed: {
      ...state.failed,
      [attempt.path]: { ...attempt, message: error.message },
    },
  })
  return {
    ok: false,
    reason: error.kind === 'auth' ? 'auth' : 'error',
    message: error.message,
  }
}

/** Retry a write that failed for a non-conflict reason. */
export async function retryWrite(path: string): Promise<SaveResult> {
  const failed = state.failed[path]
  if (!failed) return { ok: false, reason: 'error', message: 'Nothing to retry.' }
  return failed.record === null
    ? removeRecord(failed.collection, failed.id)
    : saveRecord(failed.collection, failed.record)
}

export function discardFailedWrite(path: string) {
  const failed = { ...state.failed }
  delete failed[path]
  setState({ failed, status: 'idle', lastError: null })
}

/**
 * Resolve a conflict. Pass 'theirs' to drop the local edit, or a record to
 * write over the remote version — which may be mine, or a hand-merge of both.
 */
export async function resolveConflict(
  choice: 'theirs' | StoredRecord,
): Promise<SaveResult> {
  const conflict = state.conflict
  if (!conflict) return { ok: false, reason: 'error', message: 'No conflict.' }

  if (choice === 'theirs') {
    const overlay = { ...state.overlay }
    delete overlay[conflict.path]
    setState({ overlay, conflict: null, status: 'idle', lastError: null })
    await refresh()
    return { ok: true, record: conflict.theirs ?? ({} as StoredRecord) }
  }

  const token = getToken()
  const identity = getIdentity()
  const record: StoredRecord = {
    ...choice,
    updatedAt: new Date().toISOString(),
    updatedBy: identity,
  }
  const message = `resolve ${singular(conflict.collection)}: ${describeRecord(record, conflict.id)} (${identity})`

  setState({ status: 'saving' })
  try {
    const { sha } = await putRecord(
      token,
      conflict.path,
      record,
      conflict.theirSha || null,
      message,
    )
    commitLocally({
      path: conflict.path,
      collection: conflict.collection,
      id: conflict.id,
      record,
      sha,
    })
    return { ok: true, record }
  } catch (err) {
    return await handleWriteFailure(err, {
      path: conflict.path,
      collection: conflict.collection,
      id: conflict.id,
      record,
    })
  }
}

export function dismissConflict() {
  setState({ conflict: null, status: 'idle', lastError: null })
}

// ——— export ———————————————————————————————————————————————————————————

/** Everything currently known, as one JSON document. */
export function snapshotJson(): string {
  const collections: Record<string, StoredRecord[]> = {}
  for (const name of collectionNames(state.index, state.overlay)) {
    collections[name] = mergeCollection(name)
  }
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      indexCommit: state.index.commit,
      collections,
    },
    null,
    2,
  )
}

// ——— naming ———————————————————————————————————————————————————————————

function describeRecord(record: StoredRecord, id: string): string {
  const named = (record.title ?? record.name) as string | undefined
  return named && named.trim() ? named.trim() : id
}

function singular(collection: string): string {
  return collection.endsWith('s') ? collection.slice(0, -1) : collection
}

// ——— hooks ————————————————————————————————————————————————————————————

function snapshot(): State {
  return state
}

export function useSync() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot)
  return {
    status: s.status,
    lastSyncedAt: s.lastSyncedAt,
    lastError: s.lastError,
    conflict: s.conflict,
    failed: Object.values(s.failed),
    loadedOnce: s.loadedOnce,
    indexCommit: s.index.commit,
    generatedAt: s.index.generatedAt,
    pendingWrites: Object.keys(s.overlay).length,
  }
}

export function useRecords<T = StoredRecord>(collection: string): T[] {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot)
  return useMemo(() => mergeCollection(collection) as T[], [s, collection])
}

export function useRecord<T = StoredRecord>(
  collection: string,
  id: string | null,
): T | null {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot)
  return useMemo(
    () => (id ? (findRecord(collection, id) as T | null) : null),
    [s, collection, id],
  )
}

// ——— init —————————————————————————————————————————————————————————————

let started = false

/**
 * Paint from cache, fetch fresh, then refresh when the tab regains focus.
 * There is no interval poll: two people, mostly not at the same time, and a
 * manual refresh button covers the rest.
 */
export function startSync() {
  if (started) return
  started = true
  hydrate()
  void refresh()

  const onFocus = () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastRefreshAt < FOCUS_THROTTLE_MS) return
    void refresh()
  }
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onFocus)
}
