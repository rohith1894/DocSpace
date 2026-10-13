import React from 'react'
import { Cloud, CloudCheck, CloudAlert, Loader2 } from 'lucide-react'
import type { SaveStatus } from '@/types'

interface SaveStatusIndicatorProps {
  status: SaveStatus
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status }) => {
  switch (status) {
    case 'saving':
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Saving changes...</span>
        </div>
      )
    case 'saved':
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium" title="All changes saved to cloud">
          <CloudCheck className="w-4 h-4 text-emerald-600" />
          <span>Saved</span>
        </div>
      )
    case 'unsaved':
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <Cloud className="w-4 h-4" />
          <span>Unsaved changes</span>
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
          <CloudAlert className="w-4 h-4" />
          <span>Failed to save</span>
        </div>
      )
  }
}
