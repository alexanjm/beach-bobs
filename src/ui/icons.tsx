import type { ReactNode } from 'react'

/*
  Inline stroke icons. Hand-drawn on a 24x24 grid rather than pulling an icon
  package in for the handful of glyphs this app actually uses.
*/

type IconProps = { className?: string }

function svg(path: ReactNode, extra?: { fill?: boolean }) {
  return function Icon({ className = 'size-5' }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill={extra?.fill ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    )
  }
}

export const MapIcon = svg(
  <>
    <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z" />
    <path d="M9 4v13M15 7v13" />
  </>,
)

export const NoteIcon = svg(
  <>
    <path d="M5 3.5h14v17H5z" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </>,
)

export const GearIcon = svg(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
  </>,
)

export const SwatchIcon = svg(
  <>
    <path d="M4 4h7v16H4z" />
    <path d="M11 9.5 16.5 4 20 7.5 14.5 13" />
    <path d="M7.5 16.5h.01" />
  </>,
)

export const RefreshIcon = svg(
  <>
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20 4v4.5h-4.5" />
  </>,
)

export const DownloadIcon = svg(
  <>
    <path d="M12 3.5v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </>,
)

export const AlertIcon = svg(
  <>
    <path d="M12 4 2.8 20h18.4L12 4Z" />
    <path d="M12 10v4.5M12 17.4h.01" />
  </>,
)
