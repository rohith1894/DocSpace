import type { DocumentMetadata, DocumentDetail, DocumentPermission, DocumentRole } from '@/types'
import { apiClient } from './apiClient'

export interface DocumentService {
  getDocuments(): Promise<DocumentMetadata[]>
  getDocumentById(id: string): Promise<DocumentDetail>
  createDocument(title?: string): Promise<DocumentMetadata>
  updateDocumentTitle(id: string, title: string, expectedVersion?: number): Promise<DocumentMetadata>
  saveDocumentContent(id: string, content: string): Promise<void>
  deleteDocument(id: string): Promise<void>
  shareDocument(id: string, email: string, role: DocumentRole): Promise<DocumentPermission>
  removePermission(id: string, userId: string): Promise<void>
}

export class RestDocumentService implements DocumentService {
  getDocuments(): Promise<DocumentMetadata[]> {
    return apiClient<DocumentMetadata[]>('/api/documents')
  }

  getDocumentById(id: string): Promise<DocumentDetail> {
    return apiClient<DocumentDetail>(`/api/documents/${id}`)
  }

  createDocument(title = 'Untitled document'): Promise<DocumentMetadata> {
    return apiClient<DocumentMetadata>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title })
    })
  }

  updateDocumentTitle(id: string, title: string, expectedVersion?: number): Promise<DocumentMetadata> {
    return apiClient<DocumentMetadata>(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, expectedVersion })
    })
  }

  async saveDocumentContent(id: string, content: string): Promise<void> {
    await apiClient<void>(`/api/documents/${id}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    })
  }

  async deleteDocument(id: string): Promise<void> {
    await apiClient<void>(`/api/documents/${id}`, { method: 'DELETE' })
  }

  shareDocument(id: string, email: string, role: DocumentRole): Promise<DocumentPermission> {
    return apiClient<DocumentPermission>(`/api/documents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  }

  async removePermission(id: string, userId: string): Promise<void> {
    await apiClient<void>(`/api/documents/${id}/share/${userId}`, { method: 'DELETE' })
  }
}

export const documentService: DocumentService = new RestDocumentService()
