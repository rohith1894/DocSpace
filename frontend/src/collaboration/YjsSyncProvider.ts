import * as Y from 'yjs'
import { fromBase64, toBase64 } from './base64'
import { CloseCode, type ClientMessage, type Member, type ServerMessage } from './protocol'

export type ConnectionStatus = 'connecting' | 'connected' | 'offline' | 'unauthorized' | 'forbidden' | 'not-found'

export interface SyncState {
  status: ConnectionStatus
  /** True once the server log has been applied and local changes were re-sent. */
  synced: boolean
  /** True when local edits have not yet been acknowledged by the server. */
  hasUnsavedChanges: boolean
  canEdit: boolean
  members: Member[]
}

export interface ProviderListener {
  onStateChange?(state: SyncState): void
  /** Server asks this client to convert legacy HTML content into the (empty) shared document. */
  onSeedRequested?(): void
  onError?(message: string): void
}

/** Browser hooks used to detect a phone waking up or regaining network. */
export interface LifecycleSource {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface YjsSyncProviderOptions {
  url: string
  documentId: string
  token: string
  doc: Y.Doc
  listener?: ProviderListener
  WebSocketImpl?: typeof WebSocket
  lifecycle?: LifecycleSource | null
  /** Local keystrokes within this window are merged into one message. */
  flushDelayMs?: number
  pingIntervalMs?: number
  /** A socket that does not answer a ping in time is considered dead. */
  pongTimeoutMs?: number
  /** Ask the server to compact once its log has this many entries. */
  compactThreshold?: number
}

const TERMINAL_CLOSE_CODES: Record<number, ConnectionStatus> = {
  [CloseCode.UNAUTHORIZED]: 'unauthorized',
  [CloseCode.FORBIDDEN]: 'forbidden',
  [CloseCode.NOT_FOUND]: 'not-found'
}

const MAX_RECONNECT_DELAY_MS = 10_000
const SOCKET_OPEN = 1

/**
 * Keeps a Yjs document in sync with the collaboration server.
 *
 * The server holds an ordered log of updates. On every (re)connect the provider applies the full
 * log and then sends whatever the server is missing, computed from the log's state vector. That
 * single rule covers first load, edits made while a phone was offline, and messages lost when a
 * socket died mid-flight, so nothing needs to be queued while disconnected.
 */
export class YjsSyncProvider {
  private readonly options: Required<Omit<YjsSyncProviderOptions, 'listener' | 'lifecycle'>>
  private readonly listener: ProviderListener
  private readonly lifecycle: LifecycleSource | null
  private socket: WebSocket | null = null
  private state: SyncState = {
    status: 'connecting',
    synced: false,
    hasUnsavedChanges: false,
    canEdit: false,
    members: []
  }
  private pending: Uint8Array[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private lastSeq = 0
  private lastSnapshotSeq = 0
  private inFlight = 0
  private destroyed = false

  constructor(options: YjsSyncProviderOptions) {
    this.options = {
      WebSocketImpl: WebSocket,
      flushDelayMs: 30,
      pingIntervalMs: 20_000,
      pongTimeoutMs: 10_000,
      compactThreshold: 100,
      ...options
    }
    this.listener = options.listener ?? {}
    this.lifecycle = options.lifecycle === undefined ? browserLifecycle() : options.lifecycle

    this.options.doc.on('update', this.handleDocUpdate)
    this.lifecycle?.addEventListener('resume', this.handleResume)
    this.lifecycle?.addEventListener('offline', this.handleOffline)
    this.connect()
  }

  getState(): SyncState {
    return this.state
  }

  destroy(): void {
    this.destroyed = true
    this.options.doc.off('update', this.handleDocUpdate)
    this.lifecycle?.removeEventListener('resume', this.handleResume)
    this.lifecycle?.removeEventListener('offline', this.handleOffline)
    this.clearTimer('reconnectTimer')
    this.flush()
    this.dropSocket()
  }

  private connect(): void {
    if (this.destroyed || this.socket) return
    const { url, token, documentId, WebSocketImpl } = this.options
    const query = `token=${encodeURIComponent(token)}&documentId=${encodeURIComponent(documentId)}`
    const socket = new WebSocketImpl(`${url}${url.includes('?') ? '&' : '?'}${query}`)
    this.socket = socket
    this.setState({ status: 'connecting', synced: false })

    socket.onopen = () => {
      this.reconnectAttempts = 0
      this.setState({ status: 'connected' })
      this.startHeartbeat()
    }
    socket.onmessage = (event: MessageEvent) => {
      let message: ServerMessage
      try {
        message = JSON.parse(event.data as string)
      } catch {
        return
      }
      this.handleMessage(message)
    }
    socket.onclose = (event: CloseEvent) => {
      if (this.socket !== socket) return
      this.dropSocket()
      const terminal = TERMINAL_CLOSE_CODES[event.code]
      if (terminal) {
        this.setState({ status: terminal })
      } else {
        this.scheduleReconnect()
      }
    }
    // onclose always follows onerror, so reconnect logic lives there.
    socket.onerror = () => {}
  }

  private handleMessage(message: ServerMessage): void {
    const { doc } = this.options
    switch (message.type) {
      case 'SYNC': {
        const updates = message.updates.map(fromBase64)
        Y.transact(doc, () => updates.forEach((u) => Y.applyUpdate(doc, u, this)), this)
        this.lastSeq = message.seq
        this.lastSnapshotSeq = message.seq
        this.inFlight = 0
        this.pending = []
        this.setState({ canEdit: message.canEdit })

        if (message.canEdit) {
          const serverState = updates.length > 0 ? Y.encodeStateVectorFromUpdate(Y.mergeUpdates(updates)) : undefined
          const missing = Y.encodeStateAsUpdate(doc, serverState)
          if (hasChanges(missing)) this.sendUpdate(missing)
          this.maybeCompact(message.logSize)
        }
        this.setState({ synced: true, hasUnsavedChanges: this.inFlight > 0 })
        if (message.needsSeed) this.listener.onSeedRequested?.()
        break
      }
      case 'UPDATE':
        Y.applyUpdate(doc, fromBase64(message.update), this)
        this.lastSeq = Math.max(this.lastSeq, message.seq)
        break
      case 'ACK':
        this.lastSeq = Math.max(this.lastSeq, message.seq)
        this.inFlight = Math.max(0, this.inFlight - 1)
        this.setState({ hasUnsavedChanges: this.inFlight > 0 || this.pending.length > 0 })
        this.maybeCompact(message.logSize)
        break
      case 'MEMBERS':
        this.setState({ members: message.members })
        break
      case 'PONG':
        this.clearTimer('pongTimer')
        break
      case 'ERROR':
        this.listener.onError?.(message.message)
        break
    }
  }

  private readonly handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) return
    this.setState({ hasUnsavedChanges: true })
    // Before the initial sync completes, the post-sync diff will carry this change.
    if (!this.state.synced || !this.state.canEdit) return
    this.pending.push(update)
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => this.flush(), this.options.flushDelayMs)
    }
  }

  private flush(): void {
    this.clearTimer('flushTimer')
    if (this.pending.length === 0) return
    const merged = this.pending.length === 1 ? this.pending[0] : Y.mergeUpdates(this.pending)
    this.pending = []
    this.sendUpdate(merged)
  }

  private sendUpdate(update: Uint8Array): void {
    if (this.send({ type: 'UPDATE', update: toBase64(update) })) {
      this.inFlight++
    }
  }

  private maybeCompact(logSize: number): void {
    const { compactThreshold, doc } = this.options
    if (logSize < compactThreshold || this.lastSeq - this.lastSnapshotSeq < compactThreshold / 2) return
    // Everything up to lastSeq has been applied locally, so our state covers that log prefix.
    this.lastSnapshotSeq = this.lastSeq
    this.send({ type: 'SNAPSHOT', update: toBase64(Y.encodeStateAsUpdate(doc)), upToSeq: this.lastSeq })
  }

  private send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== SOCKET_OPEN) return false
    try {
      this.socket.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }

  private startHeartbeat(): void {
    this.clearTimer('pingTimer')
    this.pingTimer = setInterval(() => this.checkAlive(), this.options.pingIntervalMs)
  }

  /** Sends a ping and drops the socket if it does not answer: catches zombie sockets on mobile. */
  private checkAlive(): void {
    if (this.pongTimer !== null || !this.send({ type: 'PING' })) return
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null
      this.dropSocket()
      this.scheduleReconnect(0)
    }, this.options.pongTimeoutMs)
  }

  private readonly handleResume = (): void => {
    if (this.destroyed || this.isTerminal()) return
    if (this.socket) {
      this.checkAlive()
    } else {
      this.clearTimer('reconnectTimer')
      this.reconnectAttempts = 0
      this.connect()
    }
  }

  private readonly handleOffline = (): void => {
    if (!this.socket) return
    this.dropSocket()
    this.scheduleReconnect()
  }

  private scheduleReconnect(delayOverride?: number): void {
    if (this.destroyed || this.reconnectTimer !== null) return
    this.setState({ status: 'offline', synced: false })
    const base = Math.min(500 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS)
    const delay = delayOverride ?? base / 2 + Math.random() * (base / 2)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /** Detaches and closes the current socket without triggering its close handler. */
  private dropSocket(): void {
    this.clearTimer('pingTimer')
    this.clearTimer('pongTimer')
    this.clearTimer('flushTimer')
    this.pending = []
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
    try {
      socket.close()
    } catch {
      // already closed
    }
  }

  private isTerminal(): boolean {
    return Object.values(TERMINAL_CLOSE_CODES).includes(this.state.status)
  }

  private clearTimer(name: 'flushTimer' | 'reconnectTimer' | 'pingTimer' | 'pongTimer'): void {
    const timer = this[name]
    if (timer === null) return
    clearTimeout(timer)
    clearInterval(timer)
    this[name] = null
  }

  private setState(patch: Partial<SyncState>): void {
    const next = { ...this.state, ...patch }
    const changed = (Object.keys(patch) as (keyof SyncState)[]).some((k) => next[k] !== this.state[k])
    if (!changed) return
    this.state = next
    this.listener.onStateChange?.(next)
  }
}

function hasChanges(update: Uint8Array): boolean {
  const { structs, ds } = Y.decodeUpdate(update)
  return structs.length > 0 || ds.clients.size > 0
}

function browserLifecycle(): LifecycleSource | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  const listeners = new Map<() => void, { visibility: () => void }>()
  return {
    addEventListener(type, listener) {
      if (type === 'offline') {
        window.addEventListener('offline', listener)
        return
      }
      // 'resume': tab becomes visible again (phone unlocked), network returns, or bfcache restore
      const visibility = () => {
        if (document.visibilityState === 'visible') listener()
      }
      listeners.set(listener, { visibility })
      document.addEventListener('visibilitychange', visibility)
      window.addEventListener('online', listener)
      window.addEventListener('pageshow', listener)
    },
    removeEventListener(type, listener) {
      if (type === 'offline') {
        window.removeEventListener('offline', listener)
        return
      }
      const entry = listeners.get(listener)
      if (entry) document.removeEventListener('visibilitychange', entry.visibility)
      listeners.delete(listener)
      window.removeEventListener('online', listener)
      window.removeEventListener('pageshow', listener)
    }
  }
}
