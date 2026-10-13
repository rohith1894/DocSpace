import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { ShareModal } from '@/components/share/ShareModal'
import { Button } from '@/components/common/Button'
import { TipTapEditor } from './TipTapEditor'
import { documentService } from '@/services/documentService'
import { authService } from '@/services/authService'
import { ApiError } from '@/services/apiClient'
import { useCollaborativeDocument } from '@/hooks/useCollaborativeDocument'
import { toCollaborators, toSaveStatus } from './syncPresentation'
import type { DocumentDetail, DocumentRole } from '@/types'

/** The CRDT log is the source of truth; this HTML copy only feeds previews and legacy seeding. */
const HTML_SNAPSHOT_DELAY_MS = 2000

/** Mount with `key={documentId}` so each document gets fresh state and a fresh CRDT replica. */
interface DocumentViewProps {
  documentId: string
  onBackToDashboard: () => void
  onOpenAuth: () => void
}

export const DocumentView: React.FC<DocumentViewProps> = ({ documentId, onBackToDashboard, onOpenAuth }) => {
  const [currentUser] = useState(() => authService.getCurrentUser())
  const [token] = useState(() => authService.getToken())
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const collab = useCollaborativeDocument(documentId, doc ? token : null)
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    documentService
      .getDocumentById(documentId)
      .then((data) => active && setDoc(data))
      .catch((err) => active && setLoadError(err instanceof ApiError ? err : new ApiError(String(err), 0)))
    return () => {
      active = false
    }
  }, [documentId])

  useEffect(
    () => () => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    },
    []
  )

  const handleLocalChange = useCallback(
    (html: string) => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
      snapshotTimerRef.current = setTimeout(() => {
        documentService.saveDocumentContent(documentId, html).catch((err) => {
          console.warn('Failed to store HTML snapshot:', err)
        })
      }, HTML_SNAPSHOT_DELAY_MS)
    },
    [documentId]
  )

  const handleTitleChange = async (newTitle: string) => {
    if (!doc) return
    try {
      const updated = await documentService.updateDocumentTitle(doc.id, newTitle, doc.metadataVersion)
      setDoc((prev) => prev && { ...prev, title: updated.title, metadataVersion: updated.metadataVersion })
    } catch (err) {
      alert((err as Error).message || 'Failed to rename document')
    }
  }

  const handleAddPermission = async (email: string, role: DocumentRole) => {
    const permission = await documentService.shareDocument(documentId, email, role)
    setDoc((prev) => {
      if (!prev) return prev
      const others = (prev.permissions ?? []).filter((p) => p.email.toLowerCase() !== email.toLowerCase())
      return { ...prev, permissions: [...others, permission] }
    })
  }

  const handleRemovePermission = async (userId: string) => {
    await documentService.removePermission(documentId, userId)
    setDoc((prev) => prev && { ...prev, permissions: (prev.permissions ?? []).filter((p) => p.userId !== userId) })
  }

  const { state } = collab
  const collaborators = useMemo(() => (currentUser ? toCollaborators(state, currentUser) : []), [state, currentUser])

  const connectionError = {
    unauthorized: 'Your session has expired. Please sign in again.',
    forbidden: 'You do not have access to this document.',
    'not-found': 'This document may have been deleted.'
  }[state.status as 'unauthorized' | 'forbidden' | 'not-found']

  if (!currentUser || !token || loadError?.status === 401 || state.status === 'unauthorized') {
    return (
      <MessageScreen title="Sign In Required" message="Please sign in to view and edit this document." onBack={onBackToDashboard}>
        <Button onClick={onOpenAuth} variant="primary" size="md">
          Sign In / Register
        </Button>
      </MessageScreen>
    )
  }

  if (loadError || connectionError) {
    return (
      <MessageScreen
        title="Document Unavailable"
        message={connectionError ?? loadError?.message ?? 'This document could not be opened.'}
        onBack={onBackToDashboard}
      />
    )
  }

  if (!doc || !collab.loaded) {
    return (
      <div className="h-dvh w-screen flex flex-col items-center justify-center bg-[#f8fafd] text-gray-500">
        <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Opening document...</p>
      </div>
    )
  }

  const canEdit = doc.currentUserRole !== 'VIEWER' && state.canEdit

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[#f8fafd]">
      <Navbar
        title={doc.title}
        onTitleChange={handleTitleChange}
        saveStatus={toSaveStatus(state)}
        collaborators={collaborators}
        currentUser={currentUser}
        currentUserRole={doc.currentUserRole}
        onOpenShare={() => setIsShareOpen(true)}
        onBackToDashboard={onBackToDashboard}
      />

      <TipTapEditor
        ydoc={collab.ydoc}
        editable={canEdit}
        seedHtml={collab.seedRequested ? (doc.content ?? '') : null}
        onSeeded={collab.markSeeded}
        onLocalChange={canEdit ? handleLocalChange : undefined}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        documentTitle={doc.title}
        permissions={doc.permissions ?? []}
        onAddPermission={handleAddPermission}
        onRemovePermission={handleRemovePermission}
      />
    </div>
  )
}

interface MessageScreenProps {
  title: string
  message: string
  onBack: () => void
  children?: React.ReactNode
}

const MessageScreen: React.FC<MessageScreenProps> = ({ title, message, onBack, children }) => (
  <div className="h-dvh w-screen flex flex-col items-center justify-center bg-[#f8fafd] text-gray-600 px-4">
    <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-xs border border-gray-200 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {children}
        <Button onClick={onBack} variant="secondary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
          Back to Documents
        </Button>
      </div>
    </div>
  </div>
)
