import React, { useState, useEffect } from 'react'
import { FileText, Share2, Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { SaveStatusIndicator } from '@/components/editor/SaveStatusIndicator'
import { PresenceBar } from '@/components/editor/PresenceBar'
import type { SaveStatus, PresenceCollaborator, DocumentRole } from '@/types'

interface NavbarProps {
  title: string
  onTitleChange: (newTitle: string) => void
  saveStatus: SaveStatus
  collaborators: PresenceCollaborator[]
  currentUserRole: DocumentRole
  onOpenShare: () => void
  onBackToDashboard: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  onTitleChange,
  saveStatus,
  collaborators,
  currentUserRole,
  onOpenShare,
  onBackToDashboard
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [currentTitle, setCurrentTitle] = useState(title)

  useEffect(() => {
    setCurrentTitle(title)
  }, [title])

  const handleTitleSubmit = () => {
    setIsEditingTitle(false)
    if (currentTitle.trim() && currentTitle !== title) {
      onTitleChange(currentTitle.trim())
    } else {
      setCurrentTitle(title)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      setCurrentTitle(title)
    }
  }

  const isViewer = currentUserRole === 'VIEWER'

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-30">
      {/* Left section: App Brand Logo & Editable Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToDashboard}
          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
          title="Back to Documents"
          aria-label="Back to Documents"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToDashboard}>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {isEditingTitle && !isViewer ? (
              <input
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
                className="text-lg font-medium text-gray-800 px-1 py-0.5 border border-blue-500 rounded-sm focus:outline-none bg-blue-50/20"
              />
            ) : (
              <h1
                onClick={() => !isViewer && setIsEditingTitle(true)}
                title={isViewer ? 'Read only' : 'Click to rename document'}
                className={`text-lg font-medium text-gray-800 px-1 py-0.5 rounded-sm transition-colors ${
                  !isViewer ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default'
                }`}
              >
                {title}
              </h1>
            )}

            <SaveStatusIndicator status={saveStatus} />
          </div>

          {/* Menubar simulation */}
          <div className="flex items-center gap-3 text-xs text-gray-500 px-1 pt-0.5 select-none">
            <span className="hover:text-gray-900 cursor-pointer">File</span>
            <span className="hover:text-gray-900 cursor-pointer">Edit</span>
            <span className="hover:text-gray-900 cursor-pointer">View</span>
            <span className="hover:text-gray-900 cursor-pointer">Insert</span>
            <span className="hover:text-gray-900 cursor-pointer">Format</span>
            <span className="hover:text-gray-900 cursor-pointer">Tools</span>
          </div>
        </div>
      </div>

      {/* Right section: Presence collaborators, Share button, Profile avatar */}
      <div className="flex items-center gap-3">
        {/* Active room collaborators */}
        <PresenceBar collaborators={collaborators} />

        {/* Share Button (Google Docs blue pill button) */}
        <Button
          onClick={onOpenShare}
          variant="primary"
          size="sm"
          className="rounded-full px-4 bg-[#c2e7ff] text-[#001d35] hover:bg-[#b3ddfb] font-semibold border-none shadow-none"
          icon={currentUserRole === 'OWNER' ? <Share2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        >
          Share
        </Button>

        {/* Current user avatar */}
        <Avatar name="Demo User" color="#1a73e8" size="md" title="Logged in as Demo User" />
      </div>
    </header>
  )
}
