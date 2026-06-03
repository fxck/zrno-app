import * as React from 'react'
import { cn } from '../../lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full bg-elevated px-4 text-sm text-cream placeholder:text-muted outline-none transition-shadow focus:ring-2 focus:ring-amber/50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('font-mono text-[11px] tracking-[0.18em] uppercase text-taupe', className)}
      {...props}
    />
  )
}
