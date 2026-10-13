import type { DocumentMetadata, DocumentDetail, DocumentPermission, DocumentRole } from '@/types'
import type { IDocumentService } from './documentService'
import { apiClient } from './apiClient'

export class BackendDocumentService implements IDocumentService {
  async getDocuments(): Promise<DocumentMetadata[]> {
    return apiClient<DocumentMetadata[]>('/api/documents')
  }

  async getDocumentById(id: string): Promise<DocumentDetail> {
    return apiClient<DocumentDetail>(`/api/documents/${id}`)
  }

  async createDocument(title = 'Untitled document'): Promise<DocumentMetadata> {
    return apiClient<DocumentMetadata>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title })
    })
  }

  async updateDocumentTitle(id: string, title: string, expectedVersion?: number): Promise<DocumentMetadata> {
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
    await apiClient<void>(`/api/documents/${id}`, {
      method: 'DELETE'
    })
  }

  async shareDocument(id: string, email: string, role: DocumentRole): Promise<DocumentPermission> {
    return apiClient<DocumentPermission>(`/api/documents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  }

  async removePermission(id: string, userId: string): Promise<void> {
    await apiClient<void>(`/api/documents/${id}/share/${userId}`, {
      method: 'DELETE'
    })
  }
}
