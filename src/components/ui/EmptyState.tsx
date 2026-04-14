'use client'

import { cn } from '@/lib/cn'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {Icon && <Icon size={40} className="text-text-muted mb-3" />}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
