import type { ReactNode } from 'react'

export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-panel bg-surface p-4 ring-1 ring-line-soft ${className}`}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="label-eyebrow">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
