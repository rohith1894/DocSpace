import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { YjsSyncProvider, type ProviderListener, type SyncState } from '../YjsSyncProvider'
import { FakeServer, FakeWebSocket } from './fakeServer'

interface Client {
  doc: Y.Doc
  text: Y.Text
  provider: YjsSyncProvider
  states: SyncState[]
  seedRequests: number
  socket(): FakeWebSocket
}

let server: FakeServer
const clients: Client[] = []

function connect(user: string, overrides: Partial<ConstructorParameters<typeof YjsSyncProvider>[0]> = {}): Client {
  const doc = new Y.Doc()
  const client = { doc, text: doc.getText('t'), states: [] as SyncState[], seedRequests: 0 } as Client
  const listener: ProviderListener = {
    onStateChange: (s) => client.states.push(s),
    onSeedRequested: () => client.seedRequests++
  }
  const before = FakeWebSocket.instances.length
  client.provider = new YjsSyncProvider({
    url: 'ws://test/ws',
    documentId: 'doc-1',
    token: user,
    doc,
    listener,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    lifecycle: null,
    flushDelayMs: 5,
    ...overrides
  })
  const created = FakeWebSocket.instances.slice(before)
  client.socket = () => FakeWebSocket.instances.filter((s) => created.includes(s) || s.token === user).at(-1)!
  clients.push(client)
  return client
}

/** Lets all queued network deliveries and flush timers run. */
async function settle(ms = 50) {
  await new Promise((r) => setTimeout(r, ms))
}

beforeEach(() => {
  server = new FakeServer()
  server.users.set('alice', { name: 'Alice', canEdit: true })
  server.users.set('bob', { name: 'Bob', canEdit: true })
  server.users.set('carol', { name: 'Carol', canEdit: true })
  server.users.set('viewer', { name: 'Viewer', canEdit: false })
  FakeWebSocket.server = server
  FakeWebSocket.instances = []
})

afterEach(() => {
  clients.splice(0).forEach((c) => c.provider.destroy())
  vi.useRealTimers()
})

describe('YjsSyncProvider', () => {
  it('syncs edits between two clients', async () => {
    const laptop = connect('alice')
    const phone = connect('bob')
    await settle()

    laptop.text.insert(0, 'Hello from laptop')
    await settle()

    expect(phone.text.toString()).toBe('Hello from laptop')
    expect(laptop.provider.getState()).toMatchObject({ status: 'connected', synced: true, hasUnsavedChanges: false })
  })

  it('converges when three devices type at the same time', async () => {
    const devices = [connect('alice'), connect('bob'), connect('carol')]
    await settle()

    for (let round = 0; round < 10; round++) {
      devices.forEach((d, i) => d.text.insert(i === 1 ? 0 : d.text.length, `[${i}:${round}]`))
      await settle(round % 3 === 0 ? 0 : 20)
    }
    await settle(100)

    const [first, ...rest] = devices.map((d) => d.text.toString())
    rest.forEach((t) => expect(t).toBe(first))
    for (let i = 0; i < 3; i++) for (let r = 0; r < 10; r++) expect(first).toContain(`[${i}:${r}]`)
  })

  it('gives a late joiner the full document', async () => {
    const laptop = connect('alice')
    await settle()
    laptop.text.insert(0, 'line one\n')
    await settle()
    laptop.text.insert(9, 'line two\n')
    await settle()

    const tablet = connect('bob')
    await settle()

    expect(tablet.text.toString()).toBe('line one\nline two\n')
  })

  it('batches rapid keystrokes into a single message', async () => {
    const laptop = connect('alice')
    await settle()
    server.received = []

    for (const ch of 'typing fast') laptop.text.insert(laptop.text.length, ch)
    await settle()

    expect(server.received.filter((m) => m.type === 'UPDATE')).toHaveLength(1)
  })

  it('sends edits made while offline after reconnecting, and receives what it missed', async () => {
    const laptop = connect('alice')
    const phone = connect('bob', { flushDelayMs: 5 })
    await settle()
    laptop.text.insert(0, 'base ')
    await settle()

    phone.socket().dropConnection()
    await settle(5)
    expect(phone.provider.getState().status).toBe('offline')

    phone.text.insert(phone.text.length, 'phone-offline ')
    laptop.text.insert(laptop.text.length, 'laptop-online ')
    await settle(1500) // reconnect backoff

    expect(phone.provider.getState()).toMatchObject({ status: 'connected', synced: true })
    expect(phone.text.toString()).toBe(laptop.text.toString())
    expect(laptop.text.toString()).toContain('phone-offline')
    expect(laptop.text.toString()).toContain('laptop-online')
  })

  it('detects a silently dead socket through ping timeout and recovers', async () => {
    const laptop = connect('alice')
    const phone = connect('bob', { pingIntervalMs: 40, pongTimeoutMs: 40 })
    await settle()

    const zombie = phone.socket()
    server.freeze(zombie)
    phone.text.insert(0, 'typed on a sleeping phone ')
    await settle(400)

    expect(phone.socket()).not.toBe(zombie)
    expect(laptop.text.toString()).toBe('typed on a sleeping phone ')
  })

  it('stops reconnecting when access is denied', async () => {
    const stranger = connect('mallory')
    await settle(1500)

    expect(stranger.provider.getState().status).toBe('forbidden')
    expect(FakeWebSocket.instances.filter((s) => s.token === 'mallory')).toHaveLength(1)
  })

  it('never sends edits from a viewer', async () => {
    connect('alice')
    const viewer = connect('viewer')
    await settle()
    server.received = []

    viewer.text.insert(0, 'not allowed')
    await settle()

    expect(viewer.provider.getState().canEdit).toBe(false)
    expect(server.received.filter((m) => m.type === 'UPDATE')).toHaveLength(0)
  })

  it('asks only the first editor of an empty document to seed it', async () => {
    const first = connect('alice')
    const second = connect('bob')
    await settle()

    expect(first.seedRequests).toBe(1)
    expect(second.seedRequests).toBe(0)
  })

  it('compacts the server log and late joiners still converge', async () => {
    const laptop = connect('alice', { compactThreshold: 10 })
    await settle()
    for (let i = 0; i < 30; i++) {
      laptop.text.insert(laptop.text.length, `${i},`)
      await settle(8)
    }
    await settle()

    expect(server.received.some((m) => m.type === 'SNAPSHOT')).toBe(true)
    expect(server.log.length).toBeLessThan(30)

    const phone = connect('bob')
    await settle()
    expect(phone.text.toString()).toBe(laptop.text.toString())
  })

  it('reports members, counting multiple devices of one user once', async () => {
    const laptop = connect('alice')
    connect('alice')
    connect('bob')
    await settle()

    expect(laptop.provider.getState().members).toEqual([
      { userId: 'alice', name: 'Alice', connections: 2 },
      { userId: 'bob', name: 'Bob', connections: 1 }
    ])
  })

  it('reconnects immediately when the page resumes', async () => {
    const listeners = new Map<string, () => void>()
    const lifecycle = {
      addEventListener: (type: string, l: () => void) => listeners.set(type, l),
      removeEventListener: (type: string) => listeners.delete(type)
    }
    const phone = connect('bob', { lifecycle })
    await settle()

    listeners.get('offline')!()
    expect(phone.provider.getState().status).toBe('offline')
    listeners.get('resume')!()
    await settle(20)

    expect(phone.provider.getState()).toMatchObject({ status: 'connected', synced: true })
  })

  it('stops all activity after destroy', async () => {
    const phone = connect('bob')
    await settle()
    phone.provider.destroy()
    server.received = []

    phone.text.insert(0, 'after destroy')
    await settle()

    expect(server.received).toHaveLength(0)
  })
})
