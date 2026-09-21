import { describe, expect, it } from 'vitest'
import {
  collectionNames,
  findRecord,
  mergeCollection,
  retireOverlay,
  shaFor,
  type Overlay,
} from './merge.ts'
import type { IndexFile, StoredRecord } from './types.ts'

function record(id: string, extra: Record<string, unknown> = {}): StoredRecord {
  return {
    id,
    schemaVersion: 1,
    createdAt: '2026-09-20T00:00:00Z',
    createdBy: 'alex',
    updatedAt: '2026-09-20T00:00:00Z',
    updatedBy: 'alex',
    ...extra,
  }
}

function index(
  collections: Record<string, Record<string, { record: StoredRecord; sha: string }>>,
): IndexFile {
  return { generatedAt: '2026-09-20T00:00:00Z', commit: 'abc', collections }
}

function overlayOf(...entries: Overlay[keyof Overlay][]): Overlay {
  return Object.fromEntries(entries.map((e) => [e.path, e]))
}

const LOC = 'locations'
const path = (id: string) => `data/locations/${id}.json`

describe('mergeCollection', () => {
  it('returns index records when there is no overlay', () => {
    const i = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    expect(mergeCollection(i, {}, LOC).map((r) => r.id)).toEqual(['a'])
  })

  it('layers a local write over the indexed version', () => {
    const i = index({
      [LOC]: { a: { record: record('a', { title: 'old' }), sha: 's1' } },
    })
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: record('a', { title: 'new' }),
      sha: 's2',
    })
    expect(mergeCollection(i, o, LOC)[0]?.title).toBe('new')
  })

  it('includes a local write the index has never seen', () => {
    const o = overlayOf({
      path: path('b'),
      collection: LOC,
      id: 'b',
      record: record('b'),
      sha: 's9',
    })
    expect(mergeCollection(index({}), o, LOC).map((r) => r.id)).toEqual(['b'])
  })

  it('hides a locally deleted record still present in the index', () => {
    const i = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: null,
      sha: 's1',
    })
    expect(mergeCollection(i, o, LOC)).toEqual([])
  })

  it('ignores overlay entries belonging to other collections', () => {
    const o = overlayOf({
      path: 'data/servers/x.json',
      collection: 'servers',
      id: 'x',
      record: record('x'),
      sha: 's1',
    })
    expect(mergeCollection(index({}), o, LOC)).toEqual([])
  })
})

describe('shaFor', () => {
  it('uses the index sha when there is no local write', () => {
    const i = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    expect(shaFor(i, {}, LOC, 'a', path('a'))).toBe('s1')
  })

  it('prefers the sha our own write returned', () => {
    const i = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: record('a'),
      sha: 's2',
    })
    expect(shaFor(i, o, LOC, 'a', path('a'))).toBe('s2')
  })

  it('is null for a record nobody has written yet', () => {
    expect(shaFor(index({}), {}, LOC, 'new', path('new'))).toBeNull()
  })

  it('is null after a local delete, so a recreate is not sent a dead sha', () => {
    const i = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: null,
      sha: 's1',
    })
    expect(shaFor(i, o, LOC, 'a', path('a'))).toBeNull()
  })
})

describe('retireOverlay', () => {
  it('keeps a write the rebuilt index has not caught up with', () => {
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: record('a'),
      sha: 's2',
    })
    const stale = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    expect(Object.keys(retireOverlay(o, stale))).toEqual([path('a')])
  })

  it('drops a write once the index carries the same sha', () => {
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: record('a'),
      sha: 's2',
    })
    const fresh = index({ [LOC]: { a: { record: record('a'), sha: 's2' } } })
    expect(retireOverlay(o, fresh)).toEqual({})
  })

  it('keeps a delete while the record is still in the index', () => {
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: null,
      sha: 's1',
    })
    const stale = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    expect(Object.keys(retireOverlay(o, stale))).toEqual([path('a')])
  })

  it('drops a delete once the record is gone from the index', () => {
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: null,
      sha: 's1',
    })
    expect(retireOverlay(o, index({ [LOC]: {} }))).toEqual({})
  })

  it('keeps a brand new write against an index that lacks the collection', () => {
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: record('a'),
      sha: 's1',
    })
    expect(Object.keys(retireOverlay(o, index({})))).toEqual([path('a')])
  })
})

describe('findRecord', () => {
  it('prefers the overlay', () => {
    const i = index({
      [LOC]: { a: { record: record('a', { title: 'old' }), sha: 's1' } },
    })
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: record('a', { title: 'new' }),
      sha: 's2',
    })
    expect(findRecord(i, o, LOC, 'a', path('a'))?.title).toBe('new')
  })

  it('is null for a locally deleted record', () => {
    const i = index({ [LOC]: { a: { record: record('a'), sha: 's1' } } })
    const o = overlayOf({
      path: path('a'),
      collection: LOC,
      id: 'a',
      record: null,
      sha: 's1',
    })
    expect(findRecord(i, o, LOC, 'a', path('a'))).toBeNull()
  })
})

describe('collectionNames', () => {
  it('unions index and overlay collections', () => {
    const i = index({ servers: {}, locations: {} })
    const o = overlayOf({
      path: 'data/maps/x.json',
      collection: 'maps',
      id: 'x',
      record: record('x'),
      sha: 's1',
    })
    expect(collectionNames(i, o).sort()).toEqual(['locations', 'maps', 'servers'])
  })
})
