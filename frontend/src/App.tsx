import { useCallback, useEffect, useState } from 'react'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { DocumentView } from '@/components/editor/DocumentView'
import { AuthModal } from '@/components/auth/AuthModal'
import { documentService } from '@/services/documentService'
import { authService } from '@/services/authService'
import type { DocumentMetadata, User } from '@/types'

const docIdFromHash = () => window.location.hash.replace('#', '') || null

export function App() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeDocId, setActiveDocId] = useState<string | null>(docIdFromHash)
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser())
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => docIdFromHash() !== null && !authService.getToken())

  // The URL hash holds the open document id, so links can be shared and survive refreshes
  useEffect(() => {
    const handleHashChange = () => {
      const id = docIdFromHash()
      setActiveDocId(id)
      if (id && !authService.getToken()) setIsAuthModalOpen(true)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const loadDocuments = useCallback(async () => {
    if (!authService.getToken()) {
      setDocuments([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      setDocuments(await documentService.getDocuments())
    } catch (err) {
      console.error('Failed to load documents:', err)
      setDocuments([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refetch whenever the signed-in user changes
  useEffect(() => {
    void loadDocuments()
  }, [currentUser, loadDocuments])

  const handleOpenDocument = (id: string) => {
    window.location.hash = id
    setActiveDocId(id)
  }

  const handleBackToDashboard = () => {
    window.location.hash = ''
    setActiveDocId(null)
    loadDocuments() // Refresh list on return
  }

  const handleCreateDocument = async (title?: string) => {
    if (!authService.getToken()) {
      setIsAuthModalOpen(true)
      return
    }
    const newDoc = await documentService.createDocument(title)
    setDocuments((prev) => [newDoc, ...prev])
    handleOpenDocument(newDoc.id)
  }

  const handleDeleteDocument = async (id: string) => {
    await documentService.deleteDocument(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    if (activeDocId === id) {
      handleBackToDashboard()
    }
  }

  const handleRenameDocument = async (id: string, newTitle: string) => {
    const updated = await documentService.updateDocumentTitle(id, newTitle)
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: updated.title } : d))
    )
  }

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user)
  }

  const handleLogout = () => {
    authService.clearSession()
    setCurrentUser(null)
  }

  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#202124]">
      {activeDocId ? (
        <DocumentView
          key={`${currentUser?.id ?? 'anonymous'}:${activeDocId}`}
          documentId={activeDocId}
          onBackToDashboard={handleBackToDashboard}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      ) : (
        <DashboardView
          documents={documents}
          isLoading={isLoading}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
          onDeleteDocument={handleDeleteDocument}
          onRenameDocument={handleRenameDocument}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default App
