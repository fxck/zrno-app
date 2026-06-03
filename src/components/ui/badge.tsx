import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase',
  {
    variants: {
      variant: {
        paid: 'bg-amber/15 text-amber',
        pending: 'bg-taupe/20 text-taupe',
        failed: 'bg-red-500/15 text-red-400',
        neutral: 'bg-elevated text-taupe',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
