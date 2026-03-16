import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import type { AssetStatus, AuditAction } from '../../types'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'status' | 'action'
  status?: AssetStatus
  action?: AuditAction
  className?: string
}

const statusStyles: Record<AssetStatus, string> = {
  REGISTERED: 'border border-vault-gray/40 text-vault-gray bg-vault-gray/5',
  ASSIGNED: 'bg-vault-green/10 text-vault-green border border-vault-green/20',
  IN_REPAIR: 'bg-vault-yellow/10 text-vault-yellow border border-vault-yellow/20',
  LOST: 'bg-vault-red/10 text-vault-red border border-vault-red/20',
  WRITTEN_OFF: 'bg-vault-muted/50 text-[#4B5563] border border-vault-muted',
}

const actionStyles: Record<AuditAction, string> = {
  CREATE: 'bg-vault-green/10 text-vault-green border border-vault-green/20',
  UPDATE: 'bg-vault-blue/10 text-vault-blue border border-vault-blue/20',
  DELETE: 'bg-vault-red/10 text-vault-red border border-vault-red/20',
  STATUS_CHANGE: 'bg-vault-amber/10 text-vault-amber border border-vault-amber/20',
  ASSIGN: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  RETURN: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
}

const statusLabels: Record<AssetStatus, string> = {
  REGISTERED: 'Registered',
  ASSIGNED: 'Assigned',
  IN_REPAIR: 'In Repair',
  LOST: 'Lost',
  WRITTEN_OFF: 'Written Off',
}

export function Badge({ children, variant = 'default', status, action, className }: BadgeProps) {
  let variantStyles = 'bg-vault-muted text-vault-muted-text border border-vault-border'

  if (variant === 'status' && status) {
    variantStyles = statusStyles[status] || variantStyles
  } else if (variant === 'action' && action) {
    variantStyles = actionStyles[action] || variantStyles
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles,
        className
      )}
    >
      {variant === 'status' && status ? statusLabels[status] : children}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: AssetStatus; className?: string }) {
  return (
    <Badge variant="status" status={status} className={className}>
      {statusLabels[status]}
    </Badge>
  )
}

export function ActionBadge({ action, className }: { action: AuditAction; className?: string }) {
  return (
    <Badge variant="action" action={action} className={className}>
      {action.replace('_', ' ')}
    </Badge>
  )
}

export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        'bg-vault-amber/10 text-vault-amber border border-vault-amber/20',
        className
      )}
    >
      {category}
    </span>
  )
}
