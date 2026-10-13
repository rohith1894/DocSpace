import React, { useState, useEffect, useCallback } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { TipTapEditor } from './TipTapEditor'
import { ShareModal } from '@/components/share/ShareModal'
import { documentService } from '@/services/documentService'
import { authService } from '@/services/authService'
import { collaborationSocket, type CollaborationMessage } from '@/services/collaborationSocket'
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

  const currentUser = authService.getCurrentUser() || {
    id: 'user-demo-1',
    name: 'You',
    email: 'demo@docspace.io'
  }

  // Active collaborators dynamically tracked via WebSocket
  const [collaborators, setCollaborators] = useState<PresenceCollaborator[]>([
    {
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      color: '#4285F4',
      isCurrent: true
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

  // Connect to real-time WebSocket room
  useEffect(() => {
    collaborationSocket.connect(documentId, {
      id: currentUser.id,
      name: currentUser.name,
      color: '#4285F4'
    })

    const unsubscribe = collaborationSocket.subscribe((msg: CollaborationMessage) => {
      if (msg.type === 'JOIN' || msg.type === 'PRESENCE') {
        setCollaborators((prev) => {
          if (prev.some((c) => c.userId === msg.userId)) return prev
          return [
            ...prev,
            {
              userId: msg.userId,
              name: msg.userName,
              email: `${msg.userName.toLowerCase().replace(/\s+/g, '.')}@docspace.io`,
              color: msg.payload ? JSON.parse(msg.payload).color || '#34A853' : '#34A853'
            }
          ]
        })
      } else if (msg.type === 'LEAVE') {
        setCollaborators((prev) => prev.filter((c) => c.userId !== msg.userId))
      }
    })

    return () => {
      unsubscribe()
      collaborationSocket.disconnect()
    }
  }, [documentId, currentUser.id, currentUser.name])

  // Handle document content change with debounced autosave
  const handleContentChange = useCallback(
    async (htmlContent: string) => {
      if (!doc || doc.currentUserRole === 'VIEWER') return
      setSaveStatus('saving')
      try {
        await documentService.saveDocumentContent(doc.id, htmlContent)
        setSaveStatus('saved')

        // Notify room peers of update
        collaborationSocket.send({
          type: 'UPDATE',
          documentId: doc.id,
          userId: currentUser.id,
          userName: currentUser.name,
          payload: htmlContent
        })
      } catch {
        setSaveStatus('error')
      }
    },
    [doc, currentUser]
  )

  // Handle title rename (with optimistic locking metadata version)
  const handleTitleChange = async (newTitle: string) => {
    if (!doc || doc.currentUserRole === 'VIEWER') return
    try {
      const updated = await documentService.updateDocumentTitle(
        doc.id,
        newTitle,
        doc.metadataVersion
      )
      setDoc((prev) => (prev ? { ...prev, title: updated.title, metadataVersion: updated.metadataVersion } : null))
    } catch (err: any) {
      alert(err.message || 'Failed to rename title')
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
