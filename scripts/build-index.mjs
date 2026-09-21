#!/usr/bin/env node
/*
  Bundles every record file under data/ into data/index.json so the app can
  read the whole database with one fetch.

  Each entry carries the record's git blob sha. That is exactly the sha the
  Contents API requires to update a file, so the app gets optimistic
  concurrency for every record from one request instead of one request per
  record.

  Output is deterministic for a given commit: keys are sorted and generatedAt
  comes from the commit timestamp, not the clock. Otherwise every run would
  produce a diff and the workflow's no-op guard would never fire.
*/

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = 'data'
const OUT = join(DATA_DIR, 'index.json')

/** git's object id: sha1 over "blob <byte length>\0" followed by the bytes. */
function blobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8')
  return createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex')
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function dirs(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

function jsonFiles(path) {
  return readdirSync(path)
    .filter((f) => f.endsWith('.json'))
    .sort()
}

const collections = {}
let count = 0
const problems = []

for (const collection of dirs(DATA_DIR)) {
  const entries = {}
  for (const file of jsonFiles(join(DATA_DIR, collection))) {
    const full = join(DATA_DIR, collection, file)
    const bytes = readFileSync(full)
    let record
    try {
      record = JSON.parse(bytes.toString('utf8'))
    } catch (err) {
      problems.push(`${full}: not valid JSON (${err.message})`)
      continue
    }
    const id = record.id ?? file.replace(/\.json$/, '')
    if (record.id && record.id !== file.replace(/\.json$/, '')) {
      problems.push(`${full}: record id "${record.id}" does not match filename`)
    }
    entries[id] = { record, sha: blobSha(bytes) }
    count++
  }
  collections[collection] = entries
}

const index = {
  generatedAt: git('log', '-1', '--format=%cI'),
  commit: process.env.GITHUB_SHA ?? git('rev-parse', 'HEAD'),
  collections,
}

mkdirSync(DATA_DIR, { recursive: true })
writeFileSync(OUT, `${JSON.stringify(index, null, 2)}\n`)

const names = Object.keys(collections)
console.log(
  `wrote ${OUT}: ${count} record(s) across ${names.length} collection(s)` +
    (names.length ? ` — ${names.join(', ')}` : ''),
)

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  // Do not fail the build: one malformed file should not take the app offline.
}

// Guard against the file-size assumption this whole design rests on.
const bytes = statSync(OUT).size
if (bytes > 2_000_000) {
  console.warn(
    `\nindex.json is ${(bytes / 1e6).toFixed(1)} MB. The app fetches this whole ` +
      `file on load — time to reconsider the single-index approach.`,
  )
}
