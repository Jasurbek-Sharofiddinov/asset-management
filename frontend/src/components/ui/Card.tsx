import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, hover = false, padding = 'md', ...props }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        'bg-vault-surface border border-vault-border rounded-xl',
        'shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_4px_24px_rgba(0,0,0,0.6)]',
        hover && 'hover:border-vault-amber/20 transition-all duration-200 cursor-pointer',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h3
      className={cn(
        "font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text",
        className
      )}
    >
      {children}
    </h3>
  )
}
