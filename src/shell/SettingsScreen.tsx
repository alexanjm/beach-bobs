import { useState } from 'react'
import { OWNER, REPO, TOKEN_HELP_URL } from '../config.ts'
import { TOOLS } from '../registry/registry.ts'
import { checkToken } from '../sync/github.ts'
import {
  KNOWN_IDENTITIES,
  getIdentity,
  setIdentity,
  setToken,
  useIdentity,
  useToken,
} from '../sync/settings.ts'
import { refresh, snapshotJson, useSync } from '../sync/store.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { DownloadIcon } from '../ui/icons.tsx'
import { ago } from './SyncBadge.tsx'

export function SettingsScreen() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <IdentityPanel />
      <TokenPanel />
      {TOOLS.filter((t) => t.SettingsPanel).map((t) => {
        const Body = t.SettingsPanel!
        return (
          <Panel key={t.id} title={t.label}>
            <Body />
          </Panel>
        )
      })}
      <DataPanel />
    </div>
  )
}

function IdentityPanel() {
  const identity = useIdentity()
  const [custom, setCustom] = useState(() =>
    KNOWN_IDENTITIES.includes(getIdentity() as never) ? '' : getIdentity(),
  )

  return (
    <Panel title="Your name">
      <p className="mb-3 text-xs text-ink-muted">
        Goes on every record you add, so the map pin says who dropped it. Stored
        on this device only — nothing to do with the token.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {KNOWN_IDENTITIES.map((name) => (
          <button
            key={name}
            onClick={() => {
              setIdentity(name)
              setCustom('')
            }}
            className={[
              'rounded-control px-3 py-1.5 text-sm capitalize transition-colors',
              identity === name
                ? 'bg-accent text-accent-ink'
                : 'bg-surface-2 text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {name}
          </button>
        ))}
        <input
          value={custom}
          placeholder="someone else"
          onChange={(e) => {
            setCustom(e.target.value)
            setIdentity(e.target.value)
          }}
          className="w-40 rounded-control bg-surface-2 px-3 py-1.5 text-base md:text-sm text-ink ring-1 ring-line ring-inset outline-none placeholder:text-ink-faint focus:ring-accent"
        />
      </div>
    </Panel>
  )
}

type Check =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; login: string; canWrite: boolean }
  | { state: 'bad'; message: string }

function TokenPanel() {
  const token = useToken()
  const [draft, setDraft] = useState('')
  const [check, setCheck] = useState<Check>({ state: 'idle' })

  async function save() {
    const value = draft.trim()
    if (!value) return
    setCheck({ state: 'checking' })
    try {
      const result = await checkToken(value)
      setToken(value)
      setDraft('')
      setCheck({ state: 'ok', ...result })
      void refresh()
    } catch (err) {
      setCheck({
        state: 'bad',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <Panel title="GitHub token">
      {token ? (
        <div className="mb-3 flex items-center justify-between rounded-control bg-surface-2 px-3 py-2">
          <span className="text-sm text-ink">
            Token saved on this device
            <span className="ml-2 font-mono text-xs text-ink-faint">
              …{token.slice(-4)}
            </span>
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              setToken('')
              setCheck({ state: 'idle' })
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-ink-muted">
          Without a token you can browse everything, but not change anything.
          Nothing else is locked.
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          placeholder={token ? 'Replace token…' : 'ghp_…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          className="min-w-0 flex-1 rounded-control bg-surface-2 px-3 py-1.5 font-mono text-base md:text-sm text-ink ring-1 ring-line ring-inset outline-none placeholder:text-ink-faint focus:ring-accent"
        />
        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={!draft.trim() || check.state === 'checking'}
        >
          {check.state === 'checking' ? 'Checking…' : 'Save'}
        </Button>
      </div>

      {check.state === 'ok' && (
        <p className="mt-2 text-xs text-ok">
          Working — signed in as {check.login}.
          {check.canWrite
            ? ' Write access confirmed.'
            : ` No write access to ${OWNER}/${REPO}; you may not be a collaborator yet.`}
        </p>
      )}
      {check.state === 'bad' && (
        <p className="mt-2 text-xs text-danger">
          GitHub rejected it: {check.message}. Check it is a classic token with
          the <code className="font-mono">public_repo</code> scope.
        </p>
      )}

      <details className="mt-4 text-xs text-ink-muted">
        <summary className="cursor-pointer text-ink-faint hover:text-ink-muted">
          How to make one
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4">
          <li>
            <a
              href={TOKEN_HELP_URL}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-hi"
            >
              Open the new-token page
            </a>{' '}
            — it is pre-filled with the right scope.
          </li>
          <li>
            Classic token, scope <code className="font-mono">public_repo</code>,
            expiry <em>No expiration</em>.
          </li>
          <li>Generate it, copy it, paste it above.</li>
          <li>
            It stays in this browser. It is never committed and never leaves
            this device except to talk to GitHub.
          </li>
        </ol>
      </details>
    </Panel>
  )
}

function DataPanel() {
  const sync = useSync()

  function download() {
    const blob = new Blob([snapshotJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ark-tools-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel title="Data">
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
        <dt className="text-ink-faint">Repo</dt>
        <dd className="font-mono text-ink-muted">
          {OWNER}/{REPO}
        </dd>
        <dt className="text-ink-faint">Last synced</dt>
        <dd className="text-ink-muted">
          {sync.lastSyncedAt ? ago(sync.lastSyncedAt) : 'never'}
        </dd>
        <dt className="text-ink-faint">Index commit</dt>
        <dd className="font-mono text-ink-muted">
          {sync.indexCommit ? sync.indexCommit.slice(0, 7) : '—'}
        </dd>
        <dt className="text-ink-faint">Awaiting index</dt>
        <dd className="text-ink-muted">{sync.pendingWrites}</dd>
      </dl>

      <Button onClick={download}>
        <DownloadIcon className="size-4" />
        Download everything as JSON
      </Button>
      <p className="mt-2 text-xs text-ink-faint">
        A convenience. The repo's history is the real backup.
      </p>
    </Panel>
  )
}
