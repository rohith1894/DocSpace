/**
 * Core domain types for DocSpace application.
 * Matches backend database entity specifications and REST API contracts.
 */

export type DocumentRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  color?: string
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
  content?: string // HTML or JSON string
}

export interface PresenceCollaborator {
  userId: string
  name: string
  email: string
  color: string
  isCurrent?: boolean
  lastActive?: string
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
