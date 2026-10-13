import { useCallback, useEffect, useState } from 'react'
import * as Y from 'yjs'
import { YjsSyncProvider, type SyncState } from '@/collaboration/YjsSyncProvider'
import { COLLABORATION_WS_URL } from '@/services/config'

const INITIAL_STATE: SyncState = {
  status: 'connecting',
  synced: false,
  hasUnsavedChanges: false,
  canEdit: false,
  members: []
}

export interface CollaborativeDocument {
  ydoc: Y.Doc
  state: SyncState
  /** Set when this client must load the legacy HTML content into the empty shared document. */
  seedRequested: boolean
  markSeeded(): void
  /** True once the document content has arrived at least once; stays true while reconnecting. */
  loaded: boolean
}

/** Owns the Yjs document and its server connection for the lifetime of an open document. */
export function useCollaborativeDocument(documentId: string, token: string | null): CollaborativeDocument {
  // One CRDT replica per mount; the caller remounts when the document changes.
  const [ydoc] = useState(() => new Y.Doc())
  const [state, setState] = useState<SyncState>(INITIAL_STATE)
  const [seedRequested, setSeedRequested] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!token) return
    const provider = new YjsSyncProvider({
      url: COLLABORATION_WS_URL,
      documentId,
      token,
      doc: ydoc,
      listener: {
        onStateChange: (next) => {
          setState(next)
          if (next.synced) setLoaded(true)
        },
        onSeedRequested: () => setSeedRequested(true),
        onError: (message) => console.warn('Collaboration error:', message)
      }
    })
    return () => {
      provider.destroy()
      setState(INITIAL_STATE)
      setSeedRequested(false)
      setLoaded(false)
    }
  }, [documentId, token, ydoc])

  const markSeeded = useCallback(() => setSeedRequested(false), [])

  return { ydoc, state, seedRequested, markSeeded, loaded }
}
