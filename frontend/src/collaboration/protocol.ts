/** Wire protocol shared with the backend `/ws/collaboration` endpoint. */

export type ClientMessage =
  | { type: 'UPDATE'; update: string }
  | { type: 'SNAPSHOT'; update: string; upToSeq: number }
  | { type: 'PING' }

export interface Member {
  userId: string
  name: string
  connections: number
}

export type ServerMessage =
  | { type: 'SYNC'; updates: string[]; seq: number; logSize: number; needsSeed: boolean; canEdit: boolean }
  | { type: 'UPDATE'; update: string; seq: number }
  | { type: 'ACK'; seq: number; logSize: number }
  | { type: 'MEMBERS'; members: Member[] }
  | { type: 'PONG' }
  | { type: 'ERROR'; message: string }

/** Application close codes sent by the server when the handshake is rejected. */
export const CloseCode = {
  UNAUTHORIZED: 4401,
  FORBIDDEN: 4403,
  NOT_FOUND: 4404
} as const
