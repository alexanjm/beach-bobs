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
      className={`relative rounded-panel bg-surface/80 p-4 ring-1 ring-line-soft before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-accent/40 before:to-transparent ${className}`}
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
