import React, { useState, useEffect, useCallback } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { TipTapEditor } from './TipTapEditor'
import { ShareModal } from '@/components/share/ShareModal'
import { documentService } from '@/services/documentService'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/common/Button'
import type {
  DocumentDetail,
  SaveStatus,
  PresenceCollaborator,
  DocumentRole,
  DocumentPermission
} from '@/types'

interface DocumentViewProps {
  documentId: string
  onBackToDashboard: () => void
}

export const DocumentView: React.FC<DocumentViewProps> = ({
  documentId,
  onBackToDashboard
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isShareOpen, setIsShareOpen] = useState(false)

  // Simulated live collaborators in this document room (for initial UI and presence testing)
  const [collaborators] = useState<PresenceCollaborator[]>([
    {
      userId: 'user-demo-1',
      name: 'You',
      email: 'demo@docspace.io',
      color: '#4285F4',
      isCurrent: true
    },
    {
      userId: 'user-demo-2',
      name: 'Sarah Connor',
      email: 'sarah.editor@example.com',
      color: '#34A853'
    }
  ])

  // Load document on mount or ID change
  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    documentService
      .getDocumentById(documentId)
      .then((data) => {
        if (isMounted) {
          setDoc(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load document')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [documentId])

  // Handle document content change with autosave simulation
  const handleContentChange = useCallback(
    async (htmlContent: string) => {
      if (!doc || doc.currentUserRole === 'VIEWER') return
      setSaveStatus('saving')
      try {
        await documentService.saveDocumentContent(doc.id, htmlContent)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    },
    [doc]
  )

  // Handle title rename
  const handleTitleChange = async (newTitle: string) => {
    if (!doc || doc.currentUserRole === 'VIEWER') return
    try {
      const updated = await documentService.updateDocumentTitle(doc.id, newTitle)
      setDoc((prev) => (prev ? { ...prev, title: updated.title } : null))
    } catch {
      // Handle error gracefully
    }
  }

  // Handle granting permission
  const handleAddPermission = async (email: string, role: DocumentRole) => {
    if (!doc) return
    const newPerm = await documentService.shareDocument(doc.id, email, role)
    setDoc((prev) => {
      if (!prev) return null
      const existing = prev.permissions?.filter((p) => p.email.toLowerCase() !== email.toLowerCase()) || []
      return {
        ...prev,
        permissions: [...existing, newPerm]
      }
    })
  }

  // Handle removing permission
  const handleRemovePermission = async (userId: string) => {
    if (!doc) return
    await documentService.removePermission(doc.id, userId)
    setDoc((prev) => {
      if (!prev) return null
      return {
        ...prev,
        permissions: prev.permissions?.filter((p) => p.userId !== userId) || []
      }
    })
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafd] text-gray-500">
        <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Opening document...</p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafd] text-gray-600 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-xs border border-gray-200 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Document Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'This document may have been deleted.'}</p>
          <Button onClick={onBackToDashboard} variant="primary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Documents
          </Button>
        </div>
      </div>
    )
  }

  const permissions: DocumentPermission[] = doc.permissions || [
    {
      userId: doc.ownerId,
      email: doc.ownerEmail || 'owner@docspace.io',
      name: 'Document Owner',
      role: 'OWNER'
    }
  ]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8fafd]">
      {/* Top Navigation Bar */}
      <Navbar
        title={doc.title}
        onTitleChange={handleTitleChange}
        saveStatus={saveStatus}
        collaborators={collaborators}
        currentUserRole={doc.currentUserRole}
        onOpenShare={() => setIsShareOpen(true)}
        onBackToDashboard={onBackToDashboard}
      />

      {/* TipTap Rich Text Editor paper */}
      <TipTapEditor
        initialContent={doc.content}
        readOnly={doc.currentUserRole === 'VIEWER'}
        onContentChange={handleContentChange}
      />

      {/* Share & Role Management Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        documentTitle={doc.title}
        permissions={permissions}
        onAddPermission={handleAddPermission}
        onRemovePermission={handleRemovePermission}
      />
    </div>
  )
}
