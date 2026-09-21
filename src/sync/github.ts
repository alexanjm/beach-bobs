import { BRANCH, INDEX_PATH, OWNER, REPO } from '../config.ts'
import { decodeBase64, encodeBase64 } from './base64.ts'
import { EMPTY_INDEX, type IndexFile, type StoredRecord } from './types.ts'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const API_VERSION = '2022-11-28'

/** The token is missing, wrong, or lacks the public_repo scope. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Someone else wrote the file after we last read it. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

function headers(token: string, accept = 'application/vnd.github+json') {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  }
}

async function raise(res: Response): Promise<never> {
  let detail = ''
  try {
    const body = (await res.json()) as { message?: string }
    detail = body.message ?? ''
  } catch {
    detail = res.statusText
  }

  if (res.status === 401 || res.status === 403) {
    throw new AuthError(detail || 'Rejected by GitHub')
  }
  // 409 is the documented stale-sha response; 422 shows up for some of the
  // same cases, so both route to the same conflict handling.
  if (res.status === 409 || res.status === 422) {
    throw new ConflictError(detail || 'File changed on GitHub')
  }
  throw new GitHubError(detail || `Request failed (${res.status})`, res.status)
}

/**
 * Fetch the generated index.
 *
 * With a token, go through the API: no CDN in front of it, and the limit is
 * 5,000 requests an hour. Without one, go through raw.githubusercontent with
 * a cache-buster — the unauthenticated API limit is 60/hr per IP and browsing
 * read-only should never be able to trip it.
 */
export async function fetchIndex(token: string | null): Promise<IndexFile> {
  const url = token
    ? `${API}/repos/${OWNER}/${REPO}/contents/${INDEX_PATH}?ref=${BRANCH}`
    : `${RAW}/${OWNER}/${REPO}/${BRANCH}/${INDEX_PATH}?t=${Date.now()}`

  const res = await fetch(url, {
    cache: 'no-store',
    headers: token ? headers(token, 'application/vnd.github.raw') : undefined,
  })

  // No index yet — empty repo, or the Action has not run. Not an error.
  if (res.status === 404) return EMPTY_INDEX
  if (!res.ok) await raise(res)

  return (await res.json()) as IndexFile
}

export interface RemoteFile {
  record: StoredRecord | null
  sha: string | null
}

/** Read one record file, for conflict resolution. */
export async function fetchRecord(
  token: string,
  path: string,
): Promise<RemoteFile> {
  const res = await fetch(
    `${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { cache: 'no-store', headers: headers(token) },
  )
  if (res.status === 404) return { record: null, sha: null }
  if (!res.ok) await raise(res)

  const body = (await res.json()) as { content: string; sha: string }
  return {
    record: JSON.parse(decodeBase64(body.content)) as StoredRecord,
    sha: body.sha,
  }
}

export interface WriteResult {
  sha: string
  commit: string
}

/**
 * Create or update one record file. Omit `sha` to create; pass the sha the
 * local copy came from to update. A stale sha is what produces the conflict.
 */
export async function putRecord(
  token: string,
  path: string,
  record: StoredRecord,
  sha: string | null,
  message: string,
): Promise<WriteResult> {
  const json = `${JSON.stringify(record, null, 2)}\n`
  const res = await fetch(
    `${API}/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: encodeBase64(json),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    },
  )
  if (!res.ok) await raise(res)

  const body = (await res.json()) as {
    content: { sha: string }
    commit: { sha: string }
  }
  return { sha: body.content.sha, commit: body.commit.sha }
}

export async function deleteRecord(
  token: string,
  path: string,
  sha: string,
  message: string,
): Promise<{ commit: string }> {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  })
  if (!res.ok) await raise(res)

  const body = (await res.json()) as { commit: { sha: string } }
  return { commit: body.commit.sha }
}

/** Confirm a pasted token works and can write. Used by the settings screen. */
export async function checkToken(
  token: string,
): Promise<{ login: string; canWrite: boolean }> {
  const me = await fetch(`${API}/user`, { headers: headers(token) })
  if (!me.ok) await raise(me)
  const { login } = (await me.json()) as { login: string }

  const repo = await fetch(`${API}/repos/${OWNER}/${REPO}`, {
    headers: headers(token),
  })
  if (!repo.ok) await raise(repo)
  const body = (await repo.json()) as { permissions?: { push?: boolean } }

  return { login, canWrite: body.permissions?.push === true }
}
