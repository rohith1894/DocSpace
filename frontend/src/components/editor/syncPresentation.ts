import type { SyncState } from '@/collaboration/YjsSyncProvider'
import type { Collaborator, SaveStatus, User } from '@/types'

export function toSaveStatus(state: SyncState): SaveStatus {
  switch (state.status) {
    case 'unauthorized':
    case 'forbidden':
    case 'not-found':
      return 'error'
    case 'offline':
      return 'offline'
    case 'connecting':
      return 'saving'
    case 'connected':
      return state.synced && !state.hasUnsavedChanges ? 'saved' : 'saving'
  }
}

export function toCollaborators(state: SyncState, currentUser: User): Collaborator[] {
  const others = state.members
    .filter((m) => m.userId !== currentUser.id)
    .map((m) => ({ ...m, isCurrent: false }))
  const self = state.members.find((m) => m.userId === currentUser.id)
  return [{ userId: currentUser.id, name: currentUser.name, connections: self?.connections ?? 1, isCurrent: true }, ...others]
}
