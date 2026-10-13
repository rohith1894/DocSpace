import { useState, useEffect } from 'react'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { DocumentView } from '@/components/editor/DocumentView'
import { documentService } from '@/services/documentService'
import type { DocumentMetadata } from '@/types'

export function App() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  // Sync with browser URL hash (e.g. #doc-welcome-101) for deep linking and refresh persistence
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && hash.startsWith('doc-')) {
        setActiveDocId(hash)
      } else {
        setActiveDocId(null)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Fetch documents on initial load
  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      const docs = await documentService.getDocuments()
      setDocuments(docs)
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

  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#202124]">
      {activeDocId ? (
        <DocumentView
          documentId={activeDocId}
          onBackToDashboard={handleBackToDashboard}
        />
      ) : (
        <DashboardView
          documents={documents}
          isLoading={isLoading}
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
          onDeleteDocument={handleDeleteDocument}
          onRenameDocument={handleRenameDocument}
        />
      )}
    </div>
  )
}

export default App
