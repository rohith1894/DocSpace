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
  private documentId: string | null = null
  private user: { id: string; name: string; color: string } | null = null
  private listeners: Set<MessageHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimer: number | null = null
  private isExplicitlyClosed = false

  connect(documentId: string, user: { id: string; name: string; color: string }): void {
    this.documentId = documentId
    this.user = user
    this.isExplicitlyClosed = false
    this.initSocket()
  }

  private initSocket(): void {
    if (!this.documentId || !this.user) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/collaboration`

    try {
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        this.reconnectAttempts = 0
        // Send JOIN frame
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
          // ignore malformed frame
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
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000)

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.initSocket()
    }, delay)
  }

  send(message: CollaborationMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
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
    this.listeners.clear()
  }
}

export const collaborationSocket = new CollaborationSocket()
