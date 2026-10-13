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
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private isExplicitlyClosed = false

  constructor() {
    if (typeof window !== 'undefined') {
      // Reconnect immediately when mobile screen unlocks or browser tab becomes visible
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isExplicitlyClosed && this.documentId && this.user) {
          if (!this.socket || this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
            this.initSocket()
          }
        }
      })

      // Reconnect immediately when mobile device reconnects to Wi-Fi / cellular data
      window.addEventListener('online', () => {
        if (!this.isExplicitlyClosed && this.documentId && this.user) {
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.initSocket()
          }
        }
      })

      window.addEventListener('focus', () => {
        if (!this.isExplicitlyClosed && this.documentId && this.user) {
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.initSocket()
          }
        }
      })
    }
  }

  connect(documentId: string, user: { id: string; name: string; color: string }): void {
    this.documentId = documentId
    this.user = user
    this.isExplicitlyClosed = false

    // Initialize local cross-tab BroadcastChannel
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.close()
      }
      this.broadcastChannel = new BroadcastChannel(`docspace_room_${documentId}`)
      this.broadcastChannel.onmessage = (event) => {
        const message: CollaborationMessage = event.data
        this.listeners.forEach((listener) => listener(message))
      }
    } catch {
      // BroadcastChannel not available in older environments
    }

    this.initSocket()
    this.startHeartbeat()
  }

  private initSocket(): void {
    if (!this.documentId || !this.user || this.isExplicitlyClosed) return

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    const configuredWs = import.meta.env.VITE_WS_URL
    const defaultWs = import.meta.env.DEV
      ? 'ws://localhost:8080/ws/collaboration'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/collaboration`
    const wsUrl = configuredWs || defaultWs

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
          try {
            this.socket.close()
          } catch {
            // ignore
          }
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed) return

    this.reconnectAttempts += 1
    // Exponential backoff capped at 2.5s for fast mobile recovery
    const delay = Math.min(500 * Math.pow(1.5, Math.min(this.reconnectAttempts, 8)), 2500)

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.initSocket()
    }, delay)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    // Heartbeat every 15s to keep mobile carrier NAT & Cloudflare tunnel alive
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isExplicitlyClosed || !this.documentId || !this.user) return

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: 'PRESENCE',
          documentId: this.documentId,
          userId: this.user.id,
          userName: this.user.name,
          payload: JSON.stringify({ ping: true, color: this.user.color })
        })
      } else if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
        this.initSocket()
      }
    }, 15000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  send(message: CollaborationMessage): void {
    // 1. Send via WebSocket if open
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message))
      } catch (err) {
        console.warn('WebSocket send failed:', err)
      }
    }

    // 2. Also broadcast to other browser tabs via BroadcastChannel
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
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
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
      try {
        this.socket.close()
      } catch {
        // ignore
      }
      this.socket = null
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close()
      } catch {
        // ignore
      }
      this.broadcastChannel = null
    }
    this.listeners.clear()
  }
}

export const collaborationSocket = new CollaborationSocket()
