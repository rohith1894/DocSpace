export type CollaborationMessageType = 'JOIN' | 'UPDATE' | 'PRESENCE' | 'LEAVE' | 'SYNC'

export interface CollaborationMessage {
  type: CollaborationMessageType
  documentId: string
  userId: string
  userName: string
  payload?: string
}

export type MessageHandler = (message: CollaborationMessage) => void

export class CollaborationSocket {
  private socket: WebSocket | null = null
  private broadcastChannel: BroadcastChannel | null = null
  private documentId: string | null = null
  private user: { id: string; name: string; color: string } | null = null
  private listeners: Set<MessageHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectTimer: number | null = null
  private isExplicitlyClosed = false

  connect(documentId: string, user: { id: string; name: string; color: string }): void {
    this.documentId = documentId
    this.user = user
    this.isExplicitlyClosed = false

    // Initialize local cross-tab BroadcastChannel (peer-to-peer across browser tabs)
    try {
      this.broadcastChannel = new BroadcastChannel(`docspace_room_${documentId}`)
      this.broadcastChannel.onmessage = (event) => {
        const message: CollaborationMessage = event.data
        this.listeners.forEach((listener) => listener(message))
      }
    } catch {
      // BroadcastChannel not available in older environments
    }

    this.initSocket()
  }

  private initSocket(): void {
    if (!this.documentId || !this.user) return

    const configuredWs = import.meta.env.VITE_WS_URL
    const wsUrl =
      configuredWs ||
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/collaboration`

    try {
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        this.reconnectAttempts = 0
        this.send({
          type: 'JOIN',
          documentId: this.documentId!,
          userId: this.user!.id,
          userName: this.user!.name,
          payload: JSON.stringify({ color: this.user!.color })
        })
      }

      this.socket.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data)
          this.listeners.forEach((listener) => listener(message))
        } catch {
          // ignore invalid payload
        }
      }

      this.socket.onclose = () => {
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect()
        }
      }

      this.socket.onerror = () => {
        if (this.socket) {
          this.socket.close()
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    this.reconnectAttempts += 1
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 5000)

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.initSocket()
    }, delay)
  }

  send(message: CollaborationMessage): void {
    // 1. Send via WebSocket if open
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }

    // 2. Also broadcast to other browser tabs via BroadcastChannel (works on Vercel preview)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message)
      } catch {
        // ignore
      }
    }
  }

  broadcastPresence(active = true): void {
    if (!this.documentId || !this.user) return
    this.send({
      type: 'PRESENCE',
      documentId: this.documentId,
      userId: this.user.id,
      userName: this.user.name,
      payload: JSON.stringify({ active, color: this.user.color })
    })
  }

  subscribe(listener: MessageHandler): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  disconnect(): void {
    this.isExplicitlyClosed = true
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN && this.documentId && this.user) {
        this.send({
          type: 'LEAVE',
          documentId: this.documentId,
          userId: this.user.id,
          userName: this.user.name
        })
      }
      this.socket.close()
      this.socket = null
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }
    this.listeners.clear()
  }
}

export const collaborationSocket = new CollaborationSocket()
