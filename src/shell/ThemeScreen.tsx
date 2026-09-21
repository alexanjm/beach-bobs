import { useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'

/*
  Swatch screen. Reads the live computed value of each token off :root, so it
  can never drift from theme.css — retune the file and this screen follows.
*/

type Group = { label: string; note: string; tokens: string[] }

const GROUPS: Group[] = [
  {
    label: 'Surfaces',
    note: 'Depth comes from elevation between these, not from borders.',
    tokens: [
      '--color-bg',
      '--color-surface',
      '--color-surface-2',
      '--color-surface-3',
      '--color-line',
      '--color-line-soft',
    ],
  },
  {
    label: 'Text',
    note: 'Bone, not white. Pure white on near-black reads as generic dark mode.',
    tokens: ['--color-ink', '--color-ink-muted', '--color-ink-faint'],
  },
  {
    label: 'Accent — amber',
    note: 'Active states, primary buttons, selected marker. Rationed.',
    tokens: [
      '--color-accent',
      '--color-accent-hi',
      '--color-accent-lo',
      '--color-accent-ink',
      '--color-accent-dim',
    ],
  },
  {
    label: 'Tek — cyan',
    note: 'Rarer than amber. Tek-tier and high-value only.',
    tokens: ['--color-tek', '--color-tek-ink', '--color-tek-dim'],
  },
  {
    label: 'Status',
    note: 'Sync state, destructive actions, warnings.',
    tokens: [
      '--color-ok',
      '--color-warn',
      '--color-danger',
      '--color-danger-dim',
    ],
  },
  {
    label: 'Markers',
    note: 'A separate ramp. These encode category data, so they are allowed to be plural.',
    tokens: [
      '--color-marker-red',
      '--color-marker-olive',
      '--color-marker-steel',
      '--color-marker-violet',
      '--color-marker-amber',
      '--color-marker-cyan',
      '--color-marker-orange',
      '--color-marker-stone',
    ],
  },
]

export function ThemeScreen() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <p className="max-w-prose text-sm text-ink-muted">
        Every colour in the app resolves to one of these tokens, defined in{' '}
        <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">
          src/styles/theme.css
        </code>
        . Retune there and the whole app moves. Tell me which ones are wrong.
      </p>

      {GROUPS.map((g) => (
        <Panel key={g.label} title={g.label}>
          <p className="mb-4 text-xs text-ink-faint">{g.note}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.tokens.map((t) => (
              <Swatch key={t} token={t} />
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="Components">
        <div className="flex flex-col gap-5">
          <Row label="Buttons">
            <Button variant="primary">Save location</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">Refresh</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>

          <Row label="Elevation">
            <div className="rounded-panel bg-surface p-3 text-xs text-ink-muted">
              surface
              <div className="mt-2 rounded-control bg-surface-2 p-3">
                surface-2
                <div className="mt-2 rounded-control bg-surface-3 p-3">
                  surface-3
                </div>
              </div>
            </div>
          </Row>

          <Row label="Field">
            <input
              placeholder="Red Peak metal run"
              className="w-64 rounded-control bg-surface-2 px-3 py-1.5 text-sm text-ink ring-1 ring-line ring-inset outline-none placeholder:text-ink-faint focus:ring-accent"
            />
          </Row>

          <Row label="Tags">
            <Tag>metal</Tag>
            <Tag>turrets</Tag>
            <Tag tone="tek">tek gen</Tag>
          </Row>

          <Row label="Sync states">
            <Pill dot="var(--color-ok)">Clean</Pill>
            <Pill dot="var(--color-warn)">Saving…</Pill>
            <Pill dot="var(--color-danger)">Failed</Pill>
          </Row>

          <Row label="Markers on terrain">
            <Terrain />
          </Row>
        </div>
      </Panel>
    </div>
  )
}

function Swatch({ token }: { token: string }) {
  const value = useTokenValue(token)
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-12 rounded-control ring-1 ring-line-soft ring-inset"
        style={{ background: `var(${token})` }}
      />
      <div className="font-mono text-[11px] leading-tight text-ink-muted">
        {token.replace('--color-', '')}
      </div>
      <div className="font-mono text-[11px] leading-tight text-ink-faint">
        {value}
      </div>
    </div>
  )
}

function useTokenValue(token: string): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      token,
    )
    setValue(raw.trim())
  }, [token])
  return value
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="label-eyebrow">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Tag({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode
  tone?: 'plain' | 'tek'
}) {
  return (
    <span
      className={[
        'rounded-control px-2 py-0.5 text-xs',
        tone === 'tek'
          ? 'bg-tek-dim text-tek'
          : 'bg-surface-2 text-ink-muted ring-1 ring-line ring-inset',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function Pill({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-control bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">
      <span
        className="size-1.5 rounded-full"
        style={{ background: dot }}
        aria-hidden="true"
      />
      {children}
    </span>
  )
}

/* A stand-in for busy map imagery — the real test of marker legibility. */
function Terrain() {
  const markers = [
    { c: 'var(--color-marker-red)', x: 12, y: 30 },
    { c: 'var(--color-marker-olive)', x: 28, y: 62 },
    { c: 'var(--color-marker-steel)', x: 44, y: 22 },
    { c: 'var(--color-marker-violet)', x: 58, y: 70 },
    { c: 'var(--color-marker-amber)', x: 70, y: 38 },
    { c: 'var(--color-marker-cyan)', x: 84, y: 60 },
    { c: 'var(--color-marker-orange)', x: 92, y: 26, selected: true },
  ]
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-panel bg-[#4a4636]">
      <svg
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full opacity-70"
      >
        <path d="M0 120 L60 70 L110 110 L170 40 L240 100 L300 55 L400 105 V160 H0Z" fill="#3c3a2c" />
        <path d="M0 140 L80 105 L150 135 L230 95 L310 130 L400 100 V160 H0Z" fill="#59543f" />
        <circle cx="120" cy="45" r="26" fill="#6b6550" opacity="0.6" />
        <circle cx="330" cy="30" r="18" fill="#2f3b3a" opacity="0.8" />
      </svg>
      {markers.map((m, i) => (
        <span
          key={i}
          className="absolute size-3.5 rounded-full"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            background: m.c,
            border: '2px solid var(--color-marker-outline)',
            boxShadow: m.selected
              ? '0 0 0 2px var(--color-accent)'
              : undefined,
          }}
        />
      ))}
    </div>
  )
}
