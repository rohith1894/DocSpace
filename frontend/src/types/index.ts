/**
 * Core domain types for DocSpace.
 * Mirror the backend REST API contracts.
 */

export type DocumentRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface User {
  id: string
  email: string
  name: string
}

export interface DocumentPermission {
  userId: string
  email: string
  name?: string
  role: DocumentRole
}

export interface DocumentMetadata {
  id: string
  title: string
  ownerId: string
  ownerEmail?: string
  createdAt: string
  updatedAt: string
  metadataVersion: number
  currentUserRole: DocumentRole
  permissions?: DocumentPermission[]
}

export interface DocumentDetail extends DocumentMetadata {
  /** Last HTML rendering of the document; seeds the shared CRDT state for legacy documents. */
  content?: string
}

export interface Collaborator {
  userId: string
  name: string
  /** Number of open windows/devices this user has on the document. */
  connections: number
  isCurrent: boolean
}

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'
