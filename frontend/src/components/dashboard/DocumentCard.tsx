import React, { useState } from 'react'
import { FileText, MoreVertical, Trash2, Edit3 } from 'lucide-react'
import type { DocumentMetadata } from '@/types'

interface DocumentCardProps {
  document: DocumentMetadata
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, currentTitle: string) => void
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onOpen,
  onDelete,
  onRename
}) => {
  const [menuOpen, setMenuOpen] = useState(false)

  const formattedDate = new Date(document.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div
      onClick={() => onOpen(document.id)}
      className="group relative bg-white border border-gray-200 hover:border-blue-400 rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col"
    >
      {/* Document thumbnail placeholder (Google Docs aesthetic) */}
      <div className="h-44 bg-[#f8f9fa] border-b border-gray-100 flex items-center justify-center p-6 group-hover:bg-[#f1f3f4] transition-colors relative">
        <div className="w-24 h-32 bg-white rounded-xs shadow-xs border border-gray-200/80 p-3 flex flex-col gap-1.5 opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all">
          <div className="w-12 h-2 bg-blue-500 rounded-xs" />
          <div className="w-full h-1.5 bg-gray-200 rounded-xs" />
          <div className="w-4/5 h-1.5 bg-gray-200 rounded-xs" />
          <div className="w-full h-1.5 bg-gray-200 rounded-xs" />
          <div className="w-2/3 h-1.5 bg-gray-200 rounded-xs" />
        </div>
      </div>

      {/* Document Info Footer */}
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="overflow-hidden">
            <h3 className="text-sm font-medium text-gray-800 truncate" title={document.title}>
              {document.title}
            </h3>
            <p className="text-xs text-gray-400">Opened {formattedDate}</p>
          </div>
        </div>

        {/* Action Menu button */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 bottom-full mb-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRename(document.id, document.title)
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                Rename
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(document.id)
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
