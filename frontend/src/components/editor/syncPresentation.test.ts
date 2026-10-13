import { describe, expect, it } from 'vitest'
import { toCollaborators, toSaveStatus } from './syncPresentation'
import type { SyncState } from '@/collaboration/YjsSyncProvider'

const base: SyncState = { status: 'connected', synced: true, hasUnsavedChanges: false, canEdit: true, members: [] }

describe('toSaveStatus', () => {
  it.each([
    [{}, 'saved'],
    [{ hasUnsavedChanges: true }, 'saving'],
    [{ synced: false }, 'saving'],
    [{ status: 'connecting' }, 'saving'],
    [{ status: 'offline', synced: false }, 'offline'],
    [{ status: 'forbidden' }, 'error']
  ] as const)('%o -> %s', (patch, expected) => {
    expect(toSaveStatus({ ...base, ...patch } as SyncState)).toBe(expected)
  })
})

describe('toCollaborators', () => {
  const me = { id: 'u1', name: 'Me', email: 'me@x.io' }

  it('always lists the current user first, even before members arrive', () => {
    expect(toCollaborators(base, me)).toEqual([{ userId: 'u1', name: 'Me', connections: 1, isCurrent: true }])
  })

  it('keeps other members and the device count of the current user', () => {
    const state = {
      ...base,
      members: [
        { userId: 'u2', name: 'Bob', connections: 1 },
        { userId: 'u1', name: 'Me', connections: 3 }
      ]
    }
    expect(toCollaborators(state, me)).toEqual([
      { userId: 'u1', name: 'Me', connections: 3, isCurrent: true },
      { userId: 'u2', name: 'Bob', connections: 1, isCurrent: false }
    ])
  })
})
