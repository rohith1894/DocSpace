import type { DocumentMetadata, DocumentDetail, DocumentPermission, DocumentRole } from '@/types'
import { BackendDocumentService } from './backendDocumentService'
import { authService } from './authService'

export interface IDocumentService {
  getDocuments(): Promise<DocumentMetadata[]>
  getDocumentById(id: string): Promise<DocumentDetail>
  createDocument(title?: string): Promise<DocumentMetadata>
  updateDocumentTitle(id: string, title: string, expectedVersion?: number): Promise<DocumentMetadata>
  saveDocumentContent(id: string, content: string): Promise<void>
  deleteDocument(id: string): Promise<void>
  shareDocument(id: string, email: string, role: DocumentRole): Promise<DocumentPermission>
  removePermission(id: string, userId: string): Promise<void>
}

const STORAGE_KEY = 'docspace_documents'
const CONTENT_PREFIX = 'docspace_content_'

const INITIAL_DOCUMENTS: DocumentMetadata[] = [
  {
    id: 'doc-welcome-101',
    title: 'Welcome to DocSpace 🎉',
    ownerId: 'user-demo-1',
    ownerEmail: 'demo@docspace.io',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    metadataVersion: 1,
    currentUserRole: 'OWNER',
    permissions: [
      { userId: 'user-demo-1', email: 'demo@docspace.io', name: 'You (Owner)', role: 'OWNER' },
      { userId: 'user-demo-2', email: 'sarah.editor@example.com', name: 'Sarah Connor', role: 'EDITOR' },
      { userId: 'user-demo-3', email: 'alex.viewer@example.com', name: 'Alex Murphy', role: 'VIEWER' }
    ]
  }
]

const INITIAL_WELCOME_CONTENT = `
  <h1>Welcome to DocSpace 🚀</h1>
  <p><strong>DocSpace</strong> is a modern, high-performance collaborative document editor modeled after Google Docs.</p>
  <h2>Core Architectural Features:</h2>
  <ul>
    <li><strong>CRDT-driven Collaboration:</strong> Conflict-free state synchronization powered by Yjs.</li>
    <li><strong>Enterprise Modular Monolith:</strong> Scalable Java 21 + Spring Boot REST &amp; WebSocket backend.</li>
    <li><strong>Zero-Cost Cloud Deployment:</strong> Hosted on Vercel, Render Free Tier, and Neon Serverless PostgreSQL.</li>
    <li><strong>Role-Based Access Control:</strong> Strict separation of <em>Owner</em>, <em>Editor</em>, and <em>Viewer</em> roles.</li>
  </ul>
  <blockquote>
    "Simplicity is prerequisite for reliability." &mdash; Edsger W. Dijkstra
  </blockquote>
  <p>Try editing this text, changing heading levels, adding bullet points, or testing the document title rename above!</p>
`

export class LocalMockDocumentService implements IDocumentService {
  private getStoredList(): DocumentMetadata[] {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DOCUMENTS))
      localStorage.setItem(`${CONTENT_PREFIX}doc-welcome-101`, INITIAL_WELCOME_CONTENT)
      return INITIAL_DOCUMENTS
    }
    try {
      return JSON.parse(raw)
    } catch {
      return INITIAL_DOCUMENTS
    }
  }

  private saveStoredList(list: DocumentMetadata[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  async getDocuments(): Promise<DocumentMetadata[]> {
    const list = this.getStoredList()
    const currentUser = authService.getCurrentUser()
    if (!currentUser) return list

    // In mock mode: show documents where user is owner OR user was invited
    return list
      .filter((doc) => {
        if (!doc.ownerEmail || doc.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true
        if (doc.permissions && doc.permissions.some((p) => p.email.toLowerCase() === currentUser.email.toLowerCase())) {
          return true
        }
        return false
      })
      .map((doc) => {
        const isOwner = doc.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() || doc.ownerId === currentUser.id
        const userPerm = doc.permissions?.find((p) => p.email.toLowerCase() === currentUser.email.toLowerCase())
        const role: DocumentRole = isOwner ? 'OWNER' : userPerm?.role || 'VIEWER'
        return {
          ...doc,
          currentUserRole: role
        }
      })
  }

  async getDocumentById(id: string): Promise<DocumentDetail> {
    const list = this.getStoredList()
    const doc = list.find((d) => d.id === id)
    if (!doc) {
      throw new Error(`Document with id ${id} not found`)
    }
    const currentUser = authService.getCurrentUser()
    let role = doc.currentUserRole
    if (currentUser) {
      const isOwner = doc.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() || doc.ownerId === currentUser.id
      const userPerm = doc.permissions?.find((p) => p.email.toLowerCase() === currentUser.email.toLowerCase())
      role = isOwner ? 'OWNER' : userPerm?.role || 'VIEWER'
    }
    const content = localStorage.getItem(`${CONTENT_PREFIX}${id}`) || '<p>Start typing your document...</p>'
    return { ...doc, currentUserRole: role, content }
  }

  async createDocument(title = 'Untitled document'): Promise<DocumentMetadata> {
    const list = this.getStoredList()
    const currentUser = authService.getCurrentUser()
    const ownerEmail = currentUser?.email || 'demo@docspace.io'
    const ownerId = currentUser?.id || 'user-demo-1'
    const ownerName = currentUser?.name || 'You (Owner)'
    const newId = `doc-${Date.now()}`
    const newDoc: DocumentMetadata = {
      id: newId,
      title: title.trim() || 'Untitled document',
      ownerId,
      ownerEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadataVersion: 1,
      currentUserRole: 'OWNER',
      permissions: [
        { userId: ownerId, email: ownerEmail, name: ownerName, role: 'OWNER' }
      ]
    }
    list.unshift(newDoc)
    this.saveStoredList(list)
    localStorage.setItem(`${CONTENT_PREFIX}${newId}`, '<p></p>')
    return newDoc
  }

  async updateDocumentTitle(id: string, title: string): Promise<DocumentMetadata> {
    const list = this.getStoredList()
    const index = list.findIndex((d) => d.id === id)
    if (index === -1) throw new Error('Document not found')
    list[index].title = title.trim() || 'Untitled document'
    list[index].updatedAt = new Date().toISOString()
    list[index].metadataVersion += 1
    this.saveStoredList(list)
    return list[index]
  }

  async saveDocumentContent(id: string, content: string): Promise<void> {
    localStorage.setItem(`${CONTENT_PREFIX}${id}`, content)
    const list = this.getStoredList()
    const doc = list.find((d) => d.id === id)
    if (doc) {
      doc.updatedAt = new Date().toISOString()
      this.saveStoredList(list)
    }
  }

  async deleteDocument(id: string): Promise<void> {
    let list = this.getStoredList()
    list = list.filter((d) => d.id !== id)
    this.saveStoredList(list)
    localStorage.removeItem(`${CONTENT_PREFIX}${id}`)
  }

  async shareDocument(id: string, email: string, role: DocumentRole): Promise<DocumentPermission> {
    const list = this.getStoredList()
    const doc = list.find((d) => d.id === id)
    if (!doc) throw new Error('Document not found')
    if (!doc.permissions) doc.permissions = []
    const existing = doc.permissions.find((p) => p.email.toLowerCase() === email.toLowerCase())
    if (existing) {
      existing.role = role
      this.saveStoredList(list)
      return existing
    }
    const newPerm: DocumentPermission = {
      userId: `user-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role
    }
    doc.permissions.push(newPerm)
    this.saveStoredList(list)
    return newPerm
  }

  async removePermission(id: string, userId: string): Promise<void> {
    const list = this.getStoredList()
    const doc = list.find((d) => d.id === id)
    if (!doc || !doc.permissions) return
    doc.permissions = doc.permissions.filter((p) => p.userId !== userId)
    this.saveStoredList(list)
  }
}

/**
 * Resilient Document Service:
 * Automatically uses the real Spring Boot backend if authenticated,
 * falling back to local storage if offline or not logged in.
 */
export class ResilientDocumentService implements IDocumentService {
  private backend = new BackendDocumentService()
  private mock = new LocalMockDocumentService()

  private isBackendActive(): boolean {
    return !!authService.getToken()
  }

  async getDocuments(): Promise<DocumentMetadata[]> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.getDocuments()
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.getDocuments()
  }

  async getDocumentById(id: string): Promise<DocumentDetail> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.getDocumentById(id)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.getDocumentById(id)
  }

  async createDocument(title?: string): Promise<DocumentMetadata> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.createDocument(title)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.createDocument(title)
  }

  async updateDocumentTitle(id: string, title: string, expectedVersion?: number): Promise<DocumentMetadata> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.updateDocumentTitle(id, title, expectedVersion)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.updateDocumentTitle(id, title)
  }

  async saveDocumentContent(id: string, content: string): Promise<void> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.saveDocumentContent(id, content)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.saveDocumentContent(id, content)
  }

  async deleteDocument(id: string): Promise<void> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.deleteDocument(id)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.deleteDocument(id)
  }

  async shareDocument(id: string, email: string, role: DocumentRole): Promise<DocumentPermission> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.shareDocument(id, email, role)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.shareDocument(id, email, role)
  }

  async removePermission(id: string, userId: string): Promise<void> {
    if (this.isBackendActive()) {
      try {
        return await this.backend.removePermission(id, userId)
      } catch (e) {
        console.warn('Backend call failed, using mock data:', e)
      }
    }
    return this.mock.removePermission(id, userId)
  }
}

export const documentService: IDocumentService = new BackendDocumentService()
