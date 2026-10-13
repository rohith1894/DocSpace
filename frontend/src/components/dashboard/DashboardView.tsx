import React, { useState } from 'react'
import { FileText, Search, Plus, Folder, Loader2 } from 'lucide-react'
import { DocumentCard } from './DocumentCard'
import { Avatar } from '@/components/common/Avatar'
import { Modal } from '@/components/common/Modal'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import type { DocumentMetadata } from '@/types'

interface DashboardViewProps {
  documents: DocumentMetadata[]
  isLoading: boolean
  onCreateDocument: (title?: string) => Promise<void>
  onOpenDocument: (id: string) => void
  onDeleteDocument: (id: string) => Promise<void>
  onRenameDocument: (id: string, newTitle: string) => Promise<void>
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  documents,
  isLoading,
  onCreateDocument,
  onOpenDocument,
  onDeleteDocument,
  onRenameDocument
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [renameModalDoc, setRenameModalDoc] = useState<{ id: string; title: string } | null>(null)
  const [newTitle, setNewTitle] = useState('')

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await onCreateDocument('Untitled document')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenRename = (id: string, currentTitle: string) => {
    setRenameModalDoc({ id, title: currentTitle })
    setNewTitle(currentTitle)
  }

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameModalDoc || !newTitle.trim()) return
    await onRenameDocument(renameModalDoc.id, newTitle.trim())
    setRenameModalDoc(null)
  }

  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col">
      {/* Top Header / App Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <span className="text-xl font-medium text-gray-800 tracking-tight">DocSpace</span>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f1f3f4] hover:bg-[#e8eaed] focus:bg-white border border-transparent focus:border-blue-500 rounded-full pl-10 pr-4 py-2 text-sm text-gray-900 focus:outline-none transition-all shadow-none focus:shadow-sm"
            />
          </div>
        </div>

        {/* Profile Avatar */}
        <div className="flex items-center gap-3">
          <Avatar name="Demo User" color="#1a73e8" size="md" title="Logged in as Demo User" />
        </div>
      </header>

      {/* Template Gallery / Start New Document Section */}
      <section className="bg-[#f1f3f4] border-b border-gray-200 py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Start a new document</h2>
          <div className="flex gap-6">
            <div
              onClick={handleCreate}
              className="group flex flex-col items-center cursor-pointer"
            >
              <div className="w-36 h-48 bg-white border border-gray-300 rounded-md shadow-xs group-hover:border-blue-500 transition-all flex items-center justify-center relative overflow-hidden group-hover:shadow-md">
                {isCreating ? (
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <Plus className="w-7 h-7" />
                  </div>
                )}
              </div>
              <span className="mt-2 text-xs font-medium text-gray-700 group-hover:text-blue-600">
                Blank document
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Documents Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-800">Recent documents</h2>
          <span className="text-xs text-gray-400">
            {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Loading your documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            <Folder className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">No documents found</p>
            <p className="text-xs text-gray-400 mb-4">
              {searchQuery ? 'Try a different search keyword' : 'Create your first document to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreate} variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
                Create blank document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onOpen={onOpenDocument}
                onDelete={onDeleteDocument}
                onRename={handleOpenRename}
              />
            ))}
          </div>
        )}
      </main>

      {/* Rename Document Modal */}
      {renameModalDoc && (
        <Modal
          isOpen={true}
          onClose={() => setRenameModalDoc(null)}
          title="Rename document"
        >
          <form onSubmit={handleConfirmRename} className="space-y-4">
            <Input
              label="Document name"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRenameModalDoc(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={!newTitle.trim()}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
