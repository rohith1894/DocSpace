import React, { useState } from 'react'
import { FileText, Share2, Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { SaveStatusIndicator } from '@/components/editor/SaveStatusIndicator'
import { PresenceBar } from '@/components/editor/PresenceBar'
import type { SaveStatus, Collaborator, DocumentRole, User } from '@/types'

interface NavbarProps {
  title: string
  onTitleChange: (newTitle: string) => void
  saveStatus: SaveStatus
  collaborators: Collaborator[]
  currentUser: User
  currentUserRole: DocumentRole
  onOpenShare: () => void
  onBackToDashboard: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  onTitleChange,
  saveStatus,
  collaborators,
  currentUser,
  currentUserRole,
  onOpenShare,
  onBackToDashboard
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const isViewer = currentUserRole === 'VIEWER'

  const startEditing = () => {
    setDraftTitle(title)
    setIsEditingTitle(true)
  }

  const submitTitle = () => {
    setIsEditingTitle(false)
    const trimmed = draftTitle.trim()
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed)
    } else {
      setDraftTitle(title)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitTitle()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      setDraftTitle(title)
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2 flex items-center justify-between gap-2 sticky top-0 z-30">
      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
        <button
          onClick={onBackToDashboard}
          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          title="Back to Documents"
          aria-label="Back to Documents"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex w-9 h-9 bg-blue-600 rounded-lg items-center justify-center text-white shadow-xs shrink-0">
          <FileText className="w-5 h-5" />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {isEditingTitle && !isViewer ? (
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={submitTitle}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-base sm:text-lg font-medium text-gray-800 px-1 py-0.5 border border-blue-500 rounded-sm focus:outline-none min-w-0"
            />
          ) : (
            <h1
              onClick={() => !isViewer && startEditing()}
              title={isViewer ? title : 'Click to rename document'}
              className={`text-base sm:text-lg font-medium text-gray-800 px-1 py-0.5 rounded-sm truncate ${
                isViewer ? 'cursor-default' : 'hover:bg-gray-100 cursor-pointer'
              }`}
            >
              {title}
            </h1>
          )}
          <SaveStatusIndicator status={saveStatus} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <PresenceBar collaborators={collaborators} />

        <Button
          onClick={onOpenShare}
          variant="primary"
          size="sm"
          className="rounded-full px-3 sm:px-4 bg-[#c2e7ff] text-[#001d35] hover:bg-[#b3ddfb] font-semibold border-none shadow-none"
          icon={currentUserRole === 'OWNER' ? <Share2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        >
          <span className="hidden sm:inline">Share</span>
        </Button>

        <Avatar
          name={currentUser.name}
          size="md"
          title={`Signed in as ${currentUser.name}`}
          className="hidden sm:flex"
        />
      </div>
    </header>
  )
}
