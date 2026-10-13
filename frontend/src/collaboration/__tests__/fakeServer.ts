import type { ClientMessage, Member, ServerMessage } from '../protocol'

interface Connection {
  socket: FakeWebSocket
  userId: string
  canEdit: boolean
}

/** In-memory implementation of the backend collaboration protocol. */
export class FakeServer {
  log: { seq: number; update: string }[] = []
  seq = 0
  private connections: Connection[] = []
  private seedClaimant: FakeWebSocket | null = null
  /** userId -> role; users not listed are rejected with 4403. */
  readonly users = new Map<string, { name: string; canEdit: boolean }>()
  received: ClientMessage[] = []

  connect(socket: FakeWebSocket, token: string) {
    const user = this.users.get(token)
    if (!user) {
      socket.serverClose(4403)
      return
    }
    const conn = { socket, userId: token, canEdit: user.canEdit }
    this.connections.push(conn)
    const needsSeed = this.log.length === 0 && this.seedClaimant === null && user.canEdit
    if (needsSeed) this.seedClaimant = socket
    socket.deliver({
      type: 'SYNC',
      updates: this.log.map((e) => e.update),
      seq: this.seq,
      logSize: this.log.length,
      needsSeed,
      canEdit: user.canEdit
    })
    this.broadcastMembers()
  }

  receive(socket: FakeWebSocket, message: ClientMessage) {
    this.received.push(message)
    const conn = this.connections.find((c) => c.socket === socket)
    if (!conn) return
    switch (message.type) {
      case 'PING':
        socket.deliver({ type: 'PONG' })
        break
      case 'UPDATE': {
        if (!conn.canEdit) {
          socket.deliver({ type: 'ERROR', message: 'read only' })
          return
        }
        const entry = { seq: ++this.seq, update: message.update }
        this.log.push(entry)
        this.seedClaimant = null
        for (const c of this.connections) {
          if (c !== conn) c.socket.deliver({ type: 'UPDATE', update: entry.update, seq: entry.seq })
        }
        socket.deliver({ type: 'ACK', seq: entry.seq, logSize: this.log.length })
        break
      }
      case 'SNAPSHOT':
        if (message.upToSeq > this.seq) return
        this.log = [{ seq: message.upToSeq, update: message.update }, ...this.log.filter((e) => e.seq > message.upToSeq)]
        break
    }
  }

  disconnect(socket: FakeWebSocket) {
    this.connections = this.connections.filter((c) => c.socket !== socket)
    if (this.seedClaimant === socket) this.seedClaimant = null
    this.broadcastMembers()
  }

  /** Simulates a network partition that neither side notices (typical for a sleeping phone). */
  freeze(socket: FakeWebSocket) {
    socket.frozen = true
  }

  private broadcastMembers() {
    const members: Member[] = []
    for (const c of this.connections) {
      const existing = members.find((m) => m.userId === c.userId)
      if (existing) existing.connections++
      else members.push({ userId: c.userId, name: this.users.get(c.userId)!.name, connections: 1 })
    }
    for (const c of this.connections) c.socket.deliver({ type: 'MEMBERS', members })
  }
}

/** Minimal WebSocket stand-in that talks to a {@link FakeServer} asynchronously. */
export class FakeWebSocket {
  static server: FakeServer
  static instances: FakeWebSocket[] = []

  readyState = 0
  frozen = false
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  private readonly server = FakeWebSocket.server
  readonly token: string

  constructor(url: string) {
    this.token = new URL(url).searchParams.get('token') ?? ''
    FakeWebSocket.instances.push(this)
    setTimeout(() => {
      if (this.readyState !== 0) return
      this.readyState = 1
      this.onopen?.()
      this.server.connect(this, this.token)
    }, 0)
  }

  send(data: string) {
    if (this.readyState !== 1) throw new Error('not open')
    if (this.frozen) return
    const message = JSON.parse(data)
    setTimeout(() => this.server.receive(this, message), 0)
  }

  close() {
    if (this.readyState >= 2) return
    this.readyState = 3
    this.server.disconnect(this)
    setTimeout(() => this.onclose?.({ code: 1000 }), 0)
  }

  deliver(message: ServerMessage) {
    if (this.frozen) return
    setTimeout(() => {
      if (this.readyState === 1) this.onmessage?.({ data: JSON.stringify(message) })
    }, 0)
  }

  serverClose(code: number) {
    this.readyState = 3
    this.server.disconnect(this)
    setTimeout(() => this.onclose?.({ code }), 0)
  }

  /** Abrupt network loss: the server notices, the client gets an abnormal close. */
  dropConnection() {
    this.serverClose(1006)
  }
}
