export const P2P_MAGIC = 'NIOZY_P2P'
export const P2P_VERSION = 1
export const MAX_FRAME_BYTES = 10 * 1024 * 1024
export const FILE_CHUNK_SIZE = 64 * 1024
export const MAX_FILE_BYTES = 100 * 1024 * 1024

export type WireFrameType =
  | 'HELLO'
  | 'SESSION_REQUEST'
  | 'SESSION_ACCEPT'
  | 'SESSION_REJECT'
  | 'SESSION_RESUME'
  | 'SESSION_RESUME_ACCEPT'
  | 'SESSION_RESUME_REJECT'
  | 'ENCRYPTED'

export type EncryptedPayloadType =
  | 'CHAT_TEXT'
  | 'FILE_OFFER'
  | 'FILE_ACCEPT'
  | 'FILE_REJECT'
  | 'FILE_CHUNK'
  | 'FILE_COMPLETE'

export interface WireHelloFrame {
  type: 'HELLO'
  magic: typeof P2P_MAGIC
  version: number
  probe?: boolean
  deviceId?: string
  hostname?: string
  displayName?: string
  publicKey?: string
}

export interface WireSessionRequestFrame {
  type: 'SESSION_REQUEST'
  requestId: string
  from: {
    deviceId: string
    hostname: string
    displayName: string
    publicKey: string
  }
  ephemeralPublicKey: string
  message?: string
}

export interface WireSessionAcceptFrame {
  type: 'SESSION_ACCEPT'
  requestId: string
  ephemeralPublicKey: string
}

export interface WireSessionRejectFrame {
  type: 'SESSION_REJECT'
  requestId: string
  reason?: string
}

export interface WireEncryptedFrame {
  type: 'ENCRYPTED'
  payload: string
}

export function encodeWireFrame(frame: Record<string, unknown>): Buffer {
  const body = Buffer.from(JSON.stringify(frame), 'utf8')
  if (body.length > MAX_FRAME_BYTES) {
    throw new Error('Frame too large')
  }
  const header = Buffer.alloc(4)
  header.writeUInt32BE(body.length, 0)
  return Buffer.concat([header, body])
}

export class WireFrameReader {
  private buffer = Buffer.alloc(0)

  feed(chunk: Buffer, onFrame: (frame: Record<string, unknown>) => void): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 4) {
      const len = this.buffer.readUInt32BE(0)
      if (len > MAX_FRAME_BYTES) {
        this.buffer = Buffer.alloc(0)
        throw new Error('Frame length exceeded')
      }
      if (this.buffer.length < 4 + len) break
      const body = this.buffer.subarray(4, 4 + len).toString('utf8')
      this.buffer = this.buffer.subarray(4 + len)
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>
        if (parsed && typeof parsed === 'object') onFrame(parsed)
      } catch {
        // ignore malformed frames
      }
    }
  }

  reset(): void {
    this.buffer = Buffer.alloc(0)
  }
}

export function isValidHello(frame: Record<string, unknown>): boolean {
  return (
    frame.type === 'HELLO' &&
    frame.magic === P2P_MAGIC &&
    typeof frame.version === 'number'
  )
}
