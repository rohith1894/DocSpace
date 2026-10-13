import React from 'react'
import { CloudCheck, CloudAlert, CloudOff, Loader2 } from 'lucide-react'
import type { SaveStatus } from '@/types'

interface SaveStatusIndicatorProps {
  status: SaveStatus
}

const VARIANTS: Record<SaveStatus, { icon: React.ReactNode; label: string; className: string; title: string }> = {
  saving: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />,
    label: 'Saving...',
    className: 'text-gray-500',
    title: 'Sending your changes'
  },
  saved: {
    icon: <CloudCheck className="w-4 h-4 text-emerald-600" />,
    label: 'Saved',
    className: 'text-gray-500',
    title: 'All changes saved'
  },
  offline: {
    icon: <CloudOff className="w-4 h-4" />,
    label: 'Offline',
    className: 'text-amber-600',
    title: 'Reconnecting. Your edits are kept and will sync automatically.'
  },
  error: {
    icon: <CloudAlert className="w-4 h-4" />,
    label: 'Not saved',
    className: 'text-red-600',
    title: 'Your changes could not be saved'
  }
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status }) => {
  const variant = VARIANTS[status]
  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${variant.className}`}
      title={variant.title}
      role="status"
      data-testid="save-status"
      data-status={status}
    >
      {variant.icon}
      <span className="hidden sm:inline">{variant.label}</span>
    </div>
  )
}
