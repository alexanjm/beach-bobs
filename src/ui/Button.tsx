import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hi active:bg-accent-lo font-medium glow hover:shadow-[0_0_24px_-4px_var(--color-accent-glow)]',
  secondary:
    'bg-surface-3 text-ink hover:ring-accent/50 ring-1 ring-line ring-inset',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger-dim text-danger hover:bg-danger hover:text-ink',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-3 py-1.5 text-sm transition-colors md:min-h-0',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        className,
      ].join(' ')}
    />
  )
}
