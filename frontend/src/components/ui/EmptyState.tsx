import type { ReactNode } from 'react'
import { Package } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-vault-muted/30 mb-4">
        {icon || <Package className="h-8 w-8 text-vault-muted-text" />}
      </div>
      <h3 className="text-lg font-medium text-vault-text mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-vault-muted-text text-center max-w-md mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
