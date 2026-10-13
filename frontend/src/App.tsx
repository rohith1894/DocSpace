import { useState, useEffect } from 'react'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { DocumentView } from '@/components/editor/DocumentView'
import { AuthModal } from '@/components/auth/AuthModal'
import { documentService } from '@/services/documentService'
import { authService } from '@/services/authService'
import type { DocumentMetadata, User } from '@/types'

export function App() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // Initialize active user from localStorage on mount
  useEffect(() => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
  }, [])

  // Sync with browser URL hash (e.g. #doc-welcome-101) for deep linking and refresh persistence
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && (hash.startsWith('doc-') || hash.length > 10)) {
        setActiveDocId(hash)
        if (!authService.getToken()) {
          setIsAuthModalOpen(true)
        }
      } else {
        setActiveDocId(null)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Fetch documents on initial load or user change
  useEffect(() => {
    loadDocuments()
  }, [currentUser])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      if (!authService.getToken()) {
        setDocuments([])
        return
      }
      const docs = await documentService.getDocuments()
      setDocuments(docs)
    } catch (err: any) {
      console.error('Failed to load documents from backend:', err)
      setDocuments([])
    } finally {
      setIsLoading(false)
    }
  }

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
    loadDocuments()
  }

  const handleLogout = () => {
    authService.clearSession()
    setCurrentUser(null)
    loadDocuments()
  }

  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#202124]">
      {activeDocId ? (
        <DocumentView
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
