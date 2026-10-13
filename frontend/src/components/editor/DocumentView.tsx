import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  onOpenAuth?: () => void
}

export const DocumentView: React.FC<DocumentViewProps> = ({
  documentId,
  onBackToDashboard,
  onOpenAuth
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [remoteUpdate, setRemoteUpdate] = useState<{ content: string; revision: number } | null>(null)
  const latestContentRef = useRef<string>('')
  const dbSaveTimerRef = useRef<number | null>(null)

  const currentUser = authService.getCurrentUser() || {
    id: 'user-demo-1',
    name: 'You',
    email: 'demo@docspace.io'
  }

  const docRef = useRef(doc)
  docRef.current = doc

  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

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

  // Load document metadata and initial content from backend
  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    documentService
      .getDocumentById(documentId)
      .then((data) => {
        if (isMounted) {
          setDoc(data)
          latestContentRef.current = data.content || ''
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
  }, [documentId, currentUser.id])

  // Connect to real-time WebSocket room
  useEffect(() => {
    collaborationSocket.connect(documentId, {
      id: currentUser.id,
      name: currentUser.name,
      color: '#4285F4'
    })

    const unsubscribe = collaborationSocket.subscribe((msg: CollaborationMessage) => {
      if (msg.type === 'JOIN' || msg.type === 'PRESENCE') {
        if (msg.type === 'JOIN' && msg.userId !== currentUser.id) {
          // Announce own presence so new joiner sees us immediately
          collaborationSocket.broadcastPresence(true)

          // Immediately synchronize latest content to the newly joined peer
          if (latestContentRef.current) {
            collaborationSocket.send({
              type: 'UPDATE',
              documentId: documentId,
              userId: currentUser.id,
              userName: currentUser.name,
              payload: latestContentRef.current
            })
          }
        }
        let parsedColor = '#34A853'
        if (msg.payload) {
          try {
            parsedColor = JSON.parse(msg.payload).color || '#34A853'
          } catch {
            // fallback
          }
        }
        setCollaborators((prev) => {
          if (prev.some((c) => c.userId === msg.userId)) return prev
          return [
            ...prev,
            {
              userId: msg.userId,
              name: msg.userName,
              email: `${msg.userName.toLowerCase().replace(/\s+/g, '.')}@docspace.io`,
              color: parsedColor
            }
          ]
        })
      } else if (msg.type === 'UPDATE') {
        // Peer typed: update editor content directly
        if (msg.userId !== currentUser.id && msg.payload) {
          latestContentRef.current = msg.payload
          setRemoteUpdate({
            content: msg.payload,
            revision: Date.now() + Math.random()
          })
        }
      } else if (msg.type === 'LEAVE') {
        setCollaborators((prev) => prev.filter((c) => c.userId !== msg.userId))
      }
    })

    return () => {
      unsubscribe()
      collaborationSocket.disconnect()
    }
  }, [documentId, currentUser.id, currentUser.name])

  // Handle document content change: Instant WebSocket broadcast + Debounced DB save
  const handleContentChange = useCallback((htmlContent: string) => {
    const currentDoc = docRef.current
    const user = currentUserRef.current
    if (!currentDoc || currentDoc.currentUserRole === 'VIEWER') return

    latestContentRef.current = htmlContent

    // 1. Broadcast immediately to peers over WebSocket with 0ms delay
    collaborationSocket.send({
      type: 'UPDATE',
      documentId: currentDoc.id,
      userId: user.id,
      userName: user.name,
      payload: htmlContent
    })

    // 2. Debounce asynchronous autosave to Neon PostgreSQL database
    setSaveStatus('saving')
    if (dbSaveTimerRef.current) {
      window.clearTimeout(dbSaveTimerRef.current)
    }
    dbSaveTimerRef.current = window.setTimeout(async () => {
      try {
        await documentService.saveDocumentContent(currentDoc.id, htmlContent)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
  }, [])

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
    const isAuthRequired =
      !authService.getToken() ||
      error?.toLowerCase().includes('401') ||
      error?.toLowerCase().includes('unavailable') ||
      error?.toLowerCase().includes('unauthorized') ||
      error?.toLowerCase().includes('jwt')

    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafd] text-gray-600 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-xs border border-gray-200 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {isAuthRequired ? 'Sign In Required' : 'Document Not Found'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isAuthRequired
              ? 'Please sign in or create an account to view and edit this collaborative document in real time.'
              : (error || 'This document may have been deleted.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthRequired && onOpenAuth && (
              <Button onClick={onOpenAuth} variant="primary" size="md">
                Sign In / Register
              </Button>
            )}
            <Button onClick={onBackToDashboard} variant="secondary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Documents
            </Button>
          </div>
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

      {/* TipTap Rich Text Editor with real-time peer sync */}
      <TipTapEditor
        initialContent={doc.content}
        remoteUpdate={remoteUpdate}
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
