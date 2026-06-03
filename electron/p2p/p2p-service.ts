import { connect, createServer, type Server, type Socket } from 'net'
import { existsSync, createReadStream, statSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { P2pSettings } from '../shared/p2p-settings'
import type {
  P2pConnectResult,
  P2pHistoryResult,
  P2pIncomingRequest,
  P2pOpenConversationResult,
  P2pPeerInfo,
  P2pResult,
  P2pSessionInfo,
  P2pStatus,
} from '../shared/p2p-types'
import { getChatDir } from '../config-paths'
import { sendToRenderer } from '../main/window-ipc'
import {
  P2P_MAGIC,
  P2P_VERSION,
  WireFrameReader,
  encodeWireFrame,
  FILE_CHUNK_SIZE,
  MAX_FILE_BYTES,
  isValidHello,
  type EncryptedPayloadType,
} from './p2p-protocol'
import {
  computeResumeProof,
  computeSharedSecret,
  decryptPayload,
  deriveSessionKey,
  encryptPayload,
  generateEphemeralKeyPair,
  importPublicKey,
  loadOrCreateDeviceIdentity,
  type DeviceIdentity,
} from './p2p-crypto'
import { scanLan, probePeer } from './p2p-discovery'
import {
  appendMessage,
  createFileMessage,
  createTextMessage,
  getHistory,
  getFullHistory,
  clearPeerHistory,
  clearSessionKey,
  listKnownPeers,
  listSavedConversations,
  loadPeerMeta,
  loadSessionKey,
  hideConversationFromSidebar,
  removeSavedConversation,
  saveSessionKey,
  updateMessage,
  updatePeerMeta,
  allocateFilePath,
} from './p2p-chat-store'

type P2pPushChannel =
  | 'p2p:sessionRequest'
  | 'p2p:sessionEstablished'
  | 'p2p:sessionDisconnected'
  | 'p2p:sessionClosed'
  | 'p2p:conversationHidden'
  | 'p2p:message'
  | 'p2p:fileProgress'

interface PendingIncoming {
  requestId: string
  peer: P2pIncomingRequest['peer']
  message?: string
  socket: Socket
  reader: WireFrameReader
  theirEphemeralPublicKey: string
}

interface ActiveSession {
  sessionId: string
  peer: P2pSessionInfo['peer']
  status: P2pSessionInfo['status']
  isInitiator: boolean
  socket: Socket
  reader: WireFrameReader
  sessionKey: Buffer
  incomingFiles: Map<
    string,
    { messageId: string; fileName: string; fileSize: number; path: string; received: number }
  >
}

export class P2PService {
  private server: Server | null = null
  private settings: P2pSettings | null = null
  private identity: DeviceIdentity | null = null
  private lastError: string | undefined
  private getWindow: (() => BrowserWindow | null) | null = null
  private sessions = new Map<string, ActiveSession>()
  private pendingIncoming = new Map<string, PendingIncoming>()
  private pendingOutgoing = new Map<
    string,
    {
      socket: Socket
      reader: WireFrameReader
      requestId: string
      ephemeralPrivateKey: Buffer
      peer: P2pSessionInfo['peer']
    }
  >()

  configure(getWindow: () => BrowserWindow | null): void {
    this.getWindow = getWindow
  }

  private push(channel: P2pPushChannel, payload: unknown): void {
    const win = this.getWindow?.()
    if (win) sendToRenderer(win, channel, payload)
  }

  getStatus(): P2pStatus {
    const identity = this.identity ?? loadOrCreateDeviceIdentity()
    return {
      running: this.server !== null,
      port: this.settings?.port ?? 6869,
      deviceId: identity.deviceId,
      hostname: identity.hostname,
      displayName: identity.hostname,
      discoveryEnabled: this.settings?.discoveryEnabled ?? true,
      chatDirectory: getChatDir(),
      error: this.lastError,
    }
  }

  async start(settings: P2pSettings): Promise<P2pResult> {
    await this.stop()
    if (!settings.enabled) {
      this.settings = settings
      return { ok: true }
    }

    this.settings = settings
    this.identity = loadOrCreateDeviceIdentity()
    this.lastError = undefined

    return new Promise((resolve) => {
      const server = createServer((socket) => this.handleIncomingSocket(socket))
      server.on('error', (err: NodeJS.ErrnoException) => {
        this.lastError = err.message
        if (err.code === 'EADDRINUSE') {
          resolve({ ok: false, error: `Port ${settings.port} is already in use` })
          return
        }
        resolve({ ok: false, error: err.message })
      })
      server.listen(settings.port, '0.0.0.0', () => {
        this.server = server
        resolve({ ok: true })
      })
    })
  }

  async stop(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.socket.destroy()
    }
    this.sessions.clear()
    for (const pending of this.pendingIncoming.values()) pending.socket.destroy()
    this.pendingIncoming.clear()
    for (const pending of this.pendingOutgoing.values()) pending.socket.destroy()
    this.pendingOutgoing.clear()

    const server = this.server
    this.server = null
    if (!server) return
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  async scan(): Promise<P2pPeerInfo[]> {
    if (!this.settings?.enabled) return []
    const scanned = await scanLan(this.settings.port)
    const known = listKnownPeers().map(
      (p): P2pPeerInfo => ({
        ...p,
        lastSeen: new Date().toISOString(),
      }),
    )
    const merged = new Map<string, P2pPeerInfo>()
    for (const p of [...known, ...scanned]) merged.set(p.deviceId, p)
    return [...merged.values()]
  }

  async connect(host: string, port: number, message?: string): Promise<P2pConnectResult> {
    if (!this.settings?.enabled) return { ok: false, error: 'P2P is disabled' }
    const identity = this.identity ?? loadOrCreateDeviceIdentity()
    const requestId = randomUUID()
    const ephemeral = generateEphemeralKeyPair()

    return new Promise((resolve) => {
      const socket = connect({ host, port })
      const reader = new WireFrameReader()
      let step: 'hello' | 'request' | 'done' = 'hello'

      const fail = (error: string) => {
        socket.destroy()
        resolve({ ok: false, error })
      }

      socket.on('connect', () => {
        socket.write(
          encodeWireFrame({
            type: 'HELLO',
            magic: P2P_MAGIC,
            version: P2P_VERSION,
            deviceId: identity.deviceId,
            hostname: identity.hostname,
            displayName: identity.hostname,
            publicKey: identity.publicKey,
          }),
        )
      })

      socket.on('data', (chunk) => {
        try {
          reader.feed(chunk, (frame) => {
            if (step === 'hello') {
              if (
                !isValidHello(frame) ||
                frame.probe ||
                typeof frame.deviceId !== 'string' ||
                typeof frame.publicKey !== 'string'
              ) {
                fail('Invalid HELLO response')
                return
              }
              const peer = {
                deviceId: frame.deviceId,
                hostname: typeof frame.hostname === 'string' ? frame.hostname : host,
                displayName:
                  typeof frame.displayName === 'string'
                    ? frame.displayName
                    : typeof frame.hostname === 'string'
                      ? frame.hostname
                      : host,
                ip: host,
                port,
              }
              step = 'request'
              this.pendingOutgoing.set(requestId, {
                socket,
                reader,
                requestId,
                ephemeralPrivateKey: ephemeral.privateKey,
                peer,
              })
              socket.write(
                encodeWireFrame({
                  type: 'SESSION_REQUEST',
                  requestId,
                  from: {
                    deviceId: identity.deviceId,
                    hostname: identity.hostname,
                    displayName: identity.hostname,
                    publicKey: identity.publicKey,
                  },
                  ephemeralPublicKey: ephemeral.publicKey,
                  message,
                }),
              )
              return
            }

            if (step === 'request') {
              if (frame.type === 'SESSION_REJECT') {
                this.pendingOutgoing.delete(requestId)
                fail(typeof frame.reason === 'string' ? frame.reason : 'Connection rejected')
                return
              }
              if (
                frame.type !== 'SESSION_ACCEPT' ||
                frame.requestId !== requestId ||
                typeof frame.ephemeralPublicKey !== 'string'
              ) {
                return
              }
              step = 'done'
              const pending = this.pendingOutgoing.get(requestId)
              if (!pending) {
                fail('Session state lost')
                return
              }
              this.pendingOutgoing.delete(requestId)
              const shared = computeSharedSecret(
                ephemeral.privateKey,
                importPublicKey(frame.ephemeralPublicKey),
              )
              const sessionKey = deriveSessionKey(shared, requestId)
              const session = this.registerSession({
                peer: pending.peer,
                socket,
                reader,
                sessionKey,
                isInitiator: true,
              })
              updatePeerMeta(pending.peer, true)
              this.push('p2p:sessionEstablished', this.toSessionInfo(session))
              resolve({ ok: true, sessionId: session.sessionId })
            }
          })
        } catch (err) {
          fail(err instanceof Error ? err.message : 'Connection failed')
        }
      })

      socket.on('error', (err) => fail(err.message))
      socket.setTimeout(15000, () => fail('Connection timed out'))
    })
  }

  /** 使用已保存的会话密钥恢复 TCP 连接，不重新发起 DH 握手 */
  async resumeSession(
    peer: P2pSessionInfo['peer'],
    sessionKey: Buffer,
  ): Promise<P2pConnectResult> {
    if (!this.settings?.enabled) return { ok: false, error: 'P2P is disabled' }
    const identity = this.identity ?? loadOrCreateDeviceIdentity()
    const proof = computeResumeProof(sessionKey, identity.deviceId, peer.deviceId)
    let resolvedPeer = peer

    return new Promise((resolve) => {
      const socket = connect({ host: peer.ip, port: peer.port })
      const reader = new WireFrameReader()
      let step: 'hello' | 'resume' | 'done' = 'hello'

      const fail = (error: string) => {
        socket.destroy()
        resolve({ ok: false, error })
      }

      socket.on('connect', () => {
        socket.write(
          encodeWireFrame({
            type: 'HELLO',
            magic: P2P_MAGIC,
            version: P2P_VERSION,
            deviceId: identity.deviceId,
            hostname: identity.hostname,
            displayName: identity.hostname,
            publicKey: identity.publicKey,
          }),
        )
      })

      socket.on('data', (chunk) => {
        try {
          reader.feed(chunk, (frame) => {
            if (step === 'hello') {
              if (
                !isValidHello(frame) ||
                frame.probe ||
                typeof frame.deviceId !== 'string'
              ) {
                fail('Invalid HELLO response')
                return
              }
              resolvedPeer = {
                deviceId: frame.deviceId,
                hostname: typeof frame.hostname === 'string' ? frame.hostname : peer.hostname,
                displayName:
                  typeof frame.displayName === 'string'
                    ? frame.displayName
                    : typeof frame.hostname === 'string'
                      ? frame.hostname
                      : peer.displayName,
                ip: peer.ip,
                port: peer.port,
              }
              step = 'resume'
              socket.write(
                encodeWireFrame({
                  type: 'SESSION_RESUME',
                  deviceId: identity.deviceId,
                  proof,
                }),
              )
              return
            }

            if (step === 'resume') {
              if (frame.type === 'SESSION_RESUME_REJECT') {
                fail(
                  typeof frame.reason === 'string' ? frame.reason : 'Session resume rejected',
                )
                return
              }
              if (frame.type !== 'SESSION_RESUME_ACCEPT') return
              step = 'done'
              const session = this.registerSession({
                peer: resolvedPeer,
                socket,
                reader,
                sessionKey,
                isInitiator: true,
              })
              updatePeerMeta(resolvedPeer, true)
              this.push('p2p:sessionEstablished', this.toSessionInfo(session))
              resolve({ ok: true, sessionId: session.sessionId })
            }
          })
        } catch (err) {
          fail(err instanceof Error ? err.message : 'Resume failed')
        }
      })

      socket.on('error', (err) => fail(err.message))
      socket.setTimeout(15000, () => fail('Connection timed out'))
    })
  }

  async acceptRequest(requestId: string): Promise<P2pResult> {
    const pending = this.pendingIncoming.get(requestId)
    if (!pending) return { ok: false, error: 'Request not found' }
    const ephemeral = generateEphemeralKeyPair()
    const shared = computeSharedSecret(
      ephemeral.privateKey,
      importPublicKey(pending.theirEphemeralPublicKey),
    )
    const sessionKey = deriveSessionKey(shared, requestId)
    pending.socket.write(
      encodeWireFrame({
        type: 'SESSION_ACCEPT',
        requestId,
        ephemeralPublicKey: ephemeral.publicKey,
      }),
    )
    this.pendingIncoming.delete(requestId)
    const session = this.registerSession({
      peer: pending.peer,
      socket: pending.socket,
      reader: pending.reader,
      sessionKey,
      isInitiator: false,
    })
    updatePeerMeta(pending.peer, false)
    this.push('p2p:sessionEstablished', this.toSessionInfo(session))
    return { ok: true }
  }

  async rejectRequest(requestId: string, reason?: string): Promise<P2pResult> {
    const pending = this.pendingIncoming.get(requestId)
    if (!pending) return { ok: false, error: 'Request not found' }
    pending.socket.write(
      encodeWireFrame({
        type: 'SESSION_REJECT',
        requestId,
        reason: reason ?? 'Rejected',
      }),
    )
    pending.socket.destroy()
    this.pendingIncoming.delete(requestId)
    return { ok: true }
  }

  disconnect(sessionId: string): P2pResult {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.detachSessionSocket(session)
      session.socket.destroy()
      this.sessions.delete(sessionId)
    }
    clearSessionKey(sessionId)

    const saved = listSavedConversations().find((s) => s.sessionId === sessionId)
    if (saved) {
      this.push('p2p:sessionDisconnected', {
        ...saved,
        status: 'disconnected',
        hasSecureSession: false,
      })
    }
    return { ok: true }
  }

  hideFromSidebar(sessionId: string): P2pResult {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.detachSessionSocket(session)
      session.socket.destroy()
      this.sessions.delete(sessionId)
    }
    if (!hideConversationFromSidebar(sessionId)) {
      return { ok: false, error: 'Conversation not found' }
    }
    this.push('p2p:conversationHidden', { sessionId })
    return { ok: true }
  }

  removeConversation(sessionId: string): P2pResult {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.detachSessionSocket(session)
      session.socket.destroy()
      this.sessions.delete(sessionId)
    }
    removeSavedConversation(sessionId)
    this.push('p2p:sessionClosed', { sessionId })
    return { ok: true }
  }

  sendText(sessionId: string, text: string): P2pResult {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'connected') {
      return { ok: false, error: 'Session not connected' }
    }
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: 'Empty message' }

    const message = createTextMessage(sessionId, session.peer.deviceId, 'outbound', trimmed)
    appendMessage(message)
    this.push('p2p:message', message)

    try {
      this.sendEncrypted(session, {
        type: 'CHAT_TEXT',
        text: trimmed,
        sentAt: message.sentAt,
        messageId: message.id,
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Send failed' }
    }
  }

  async sendFile(sessionId: string, localPath: string): Promise<P2pResult> {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'connected') {
      return { ok: false, error: 'Session not connected' }
    }
    if (!existsSync(localPath)) return { ok: false, error: 'File not found' }

    const stat = statSync(localPath)
    if (!stat.isFile()) return { ok: false, error: 'Not a file' }
    if (stat.size > MAX_FILE_BYTES) {
      return { ok: false, error: `File exceeds ${MAX_FILE_BYTES} bytes` }
    }

    const fileName = basename(localPath)
    const mimeType = guessMimeType(fileName)
    const message = createFileMessage(
      sessionId,
      session.peer.deviceId,
      'outbound',
      fileName,
      stat.size,
      mimeType,
      localPath,
    )
    message.transferStatus = 'transferring'
    appendMessage(message)
    this.push('p2p:message', message)

    try {
      this.sendEncrypted(session, {
        type: 'FILE_OFFER',
        fileId: message.id,
        fileName,
        fileSize: stat.size,
        mimeType,
      })

      await this.streamFileToPeer(session, message.id, localPath, stat.size)
      updateMessage(session.peer.deviceId, message.id, { transferStatus: 'complete' })
      this.push('p2p:message', { ...message, transferStatus: 'complete' })
      return { ok: true }
    } catch (err) {
      updateMessage(session.peer.deviceId, message.id, { transferStatus: 'failed' })
      this.push('p2p:message', { ...message, transferStatus: 'failed' })
      return { ok: false, error: err instanceof Error ? err.message : 'File send failed' }
    }
  }

  getSessions(): P2pSessionInfo[] {
    return [...this.sessions.values()].map((s) => this.toSessionInfo(s))
  }

  getConversations(): P2pSessionInfo[] {
    const saved = listSavedConversations()
    const active = new Map(this.getSessions().map((s) => [s.sessionId, s]))
    return saved.map((s) => active.get(s.sessionId) ?? s)
  }

  async openConversation(deviceId: string): Promise<P2pOpenConversationResult> {
    const active = this.sessions.get(deviceId)
    if (active?.status === 'connected') {
      return { ok: true, session: this.toSessionInfo(active), online: true }
    }

    const saved = listSavedConversations({ includeHidden: true }).find(
      (s) => s.sessionId === deviceId,
    )
    if (!saved) return { ok: false, error: 'Conversation not found', online: false }

    const peer = { ...saved.peer }
    let online = false
    try {
      const probed = await probePeer(peer.ip, peer.port)
      online = probed?.deviceId === peer.deviceId
    } catch {
      online = false
    }

    if (online) {
      updatePeerMeta(peer, saved.isInitiator)
    }

    if (!online) {
      return {
        ok: false,
        online: false,
        error: 'Peer is offline or unreachable at saved address',
        session: { ...saved, peer, status: 'disconnected' },
      }
    }

    const sessionKey =
      this.sessions.get(deviceId)?.sessionKey ?? loadSessionKey(deviceId) ?? null

    if (sessionKey) {
      const resumeResult = await this.resumeSession(peer, sessionKey)
      if (resumeResult.ok && resumeResult.sessionId) {
        const session = this.sessions.get(resumeResult.sessionId)
        if (session) {
          return { ok: true, session: this.toSessionInfo(session), online: true }
        }
      }
      if (resumeResult.error) {
        return {
          ok: false,
          online: true,
          handshakeFailed: true,
          error: resumeResult.error,
          session: {
            ...saved,
            peer,
            status: 'disconnected',
            hasSecureSession: true,
          },
        }
      }
    }

    const connectResult = await this.connect(peer.ip, peer.port)
    if (connectResult.ok && connectResult.sessionId) {
      const session = this.sessions.get(connectResult.sessionId)
      if (session) {
        return { ok: true, session: this.toSessionInfo(session), online: true }
      }
    }

    return {
      ok: false,
      online: true,
      handshakeFailed: true,
      error: connectResult.error ?? 'Handshake failed',
      session: {
        ...saved,
        peer,
        status: 'disconnected',
        hasSecureSession: Boolean(sessionKey),
      },
    }
  }

  loadHistory(sessionId: string): P2pHistoryResult {
    const session = this.sessions.get(sessionId)
    const peerDeviceId = session?.peer.deviceId ?? sessionId
    try {
      return { ok: true, messages: getHistory(peerDeviceId) }
    } catch (err) {
      return {
        ok: false,
        messages: [],
        error: err instanceof Error ? err.message : 'Failed to load history',
      }
    }
  }

  loadFullHistory(sessionId: string): P2pHistoryResult {
    const session = this.sessions.get(sessionId)
    const peerDeviceId = session?.peer.deviceId ?? sessionId
    try {
      return { ok: true, messages: getFullHistory(peerDeviceId) }
    } catch (err) {
      return {
        ok: false,
        messages: [],
        error: err instanceof Error ? err.message : 'Failed to load history',
      }
    }
  }

  clearHistory(sessionId: string): P2pResult {
    const session = this.sessions.get(sessionId)
    const peerDeviceId = session?.peer.deviceId ?? sessionId
    try {
      clearPeerHistory(peerDeviceId)
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to clear history',
      }
    }
  }

  loadHistoryByPeer(peerDeviceId: string): P2pHistoryResult {
    try {
      return { ok: true, messages: getHistory(peerDeviceId) }
    } catch (err) {
      return {
        ok: false,
        messages: [],
        error: err instanceof Error ? err.message : 'Failed to load history',
      }
    }
  }

  private handleIncomingSocket(socket: Socket): void {
    const reader = new WireFrameReader()
    const identity = this.identity ?? loadOrCreateDeviceIdentity()
    let handled = false

    socket.on('data', (chunk) => {
      if (handled) {
        const session = this.findSessionBySocket(socket)
        if (session) this.handleSessionData(session, chunk)
        return
      }

      try {
        reader.feed(chunk, (frame) => {
          if (isValidHello(frame)) {
            if (frame.probe) {
              if (!this.settings?.discoveryEnabled) {
                socket.destroy()
                return
              }
              socket.write(
                encodeWireFrame({
                  type: 'HELLO',
                  magic: P2P_MAGIC,
                  version: P2P_VERSION,
                  deviceId: identity.deviceId,
                  hostname: identity.hostname,
                  displayName: identity.hostname,
                  publicKey: identity.publicKey,
                }),
              )
              socket.end()
              handled = true
              return
            }
            socket.write(
              encodeWireFrame({
                type: 'HELLO',
                magic: P2P_MAGIC,
                version: P2P_VERSION,
                deviceId: identity.deviceId,
                hostname: identity.hostname,
                displayName: identity.hostname,
                publicKey: identity.publicKey,
              }),
            )
            return
          }

          if (
            frame.type === 'SESSION_RESUME' &&
            typeof frame.deviceId === 'string' &&
            typeof frame.proof === 'string'
          ) {
            handled = true
            const remoteDeviceId = frame.deviceId
            const sessionKey = loadSessionKey(remoteDeviceId)
            if (!sessionKey) {
              socket.write(
                encodeWireFrame({
                  type: 'SESSION_RESUME_REJECT',
                  deviceId: remoteDeviceId,
                  reason: 'No saved session',
                }),
              )
              socket.destroy()
              return
            }
            const expectedProof = computeResumeProof(
              sessionKey,
              remoteDeviceId,
              identity.deviceId,
            )
            if (expectedProof !== frame.proof) {
              socket.write(
                encodeWireFrame({
                  type: 'SESSION_RESUME_REJECT',
                  deviceId: remoteDeviceId,
                  reason: 'Invalid resume proof',
                }),
              )
              socket.destroy()
              return
            }
            const remoteIp = socket.remoteAddress?.replace(/^::ffff:/, '') ?? 'unknown'
            const meta = loadPeerMeta(remoteDeviceId)
            const peer = {
              deviceId: remoteDeviceId,
              hostname: meta?.hostname ?? remoteIp,
              displayName: meta?.displayName ?? meta?.hostname ?? remoteIp,
              ip: remoteIp,
              port: this.settings?.port ?? 6869,
            }
            socket.write(
              encodeWireFrame({
                type: 'SESSION_RESUME_ACCEPT',
                deviceId: identity.deviceId,
              }),
            )
            const session = this.registerSession({
              peer,
              socket,
              reader,
              sessionKey,
              isInitiator: false,
            })
            updatePeerMeta(peer, false)
            this.push('p2p:sessionEstablished', this.toSessionInfo(session))
            return
          }

          if (frame.type === 'SESSION_REQUEST' && typeof frame.requestId === 'string') {
            handled = true
            const from = frame.from as Record<string, unknown> | undefined
            if (
              !from ||
              typeof from.deviceId !== 'string' ||
              typeof from.publicKey !== 'string' ||
              typeof frame.ephemeralPublicKey !== 'string'
            ) {
              socket.destroy()
              return
            }
            const remoteIp = socket.remoteAddress?.replace(/^::ffff:/, '') ?? 'unknown'
            const peer = {
              deviceId: from.deviceId,
              hostname: typeof from.hostname === 'string' ? from.hostname : remoteIp,
              displayName:
                typeof from.displayName === 'string'
                  ? from.displayName
                  : typeof from.hostname === 'string'
                    ? from.hostname
                    : remoteIp,
              ip: remoteIp,
              port: this.settings?.port ?? 6869,
            }
            this.pendingIncoming.set(frame.requestId, {
              requestId: frame.requestId,
              peer,
              message: typeof frame.message === 'string' ? frame.message : undefined,
              socket,
              reader,
              theirEphemeralPublicKey: frame.ephemeralPublicKey,
            })
            const request: P2pIncomingRequest = {
              requestId: frame.requestId,
              peer,
              message: typeof frame.message === 'string' ? frame.message : undefined,
            }
            this.push('p2p:sessionRequest', request)
          }
        })
      } catch {
        socket.destroy()
      }
    })

    socket.on('close', () => {
      const session = this.findSessionBySocket(socket)
      if (session) this.markSessionDisconnected(session.sessionId)
    })

    socket.on('error', () => {
      socket.destroy()
    })
  }

  private registerSession(input: {
    peer: P2pSessionInfo['peer']
    socket: Socket
    reader: WireFrameReader
    sessionKey: Buffer
    isInitiator: boolean
  }): ActiveSession {
    for (const [id, existing] of this.sessions) {
      if (existing.peer.deviceId === input.peer.deviceId) {
        this.detachSessionSocket(existing)
        existing.socket.destroy()
        this.sessions.delete(id)
      }
    }

    const session: ActiveSession = {
      sessionId: input.peer.deviceId,
      peer: input.peer,
      status: 'connected',
      isInitiator: input.isInitiator,
      socket: input.socket,
      reader: input.reader,
      sessionKey: input.sessionKey,
      incomingFiles: new Map(),
    }
    this.sessions.set(session.sessionId, session)
    saveSessionKey(session.sessionId, session.sessionKey)

    const onData = (chunk: Buffer) => this.handleSessionData(session, chunk)
    input.socket.removeAllListeners('data')
    input.socket.on('data', onData)

    return session
  }

  private handleSessionData(session: ActiveSession, chunk: Buffer): void {
    try {
      session.reader.feed(chunk, (frame) => {
        if (frame.type !== 'ENCRYPTED' || typeof frame.payload !== 'string') return
        let inner: Record<string, unknown>
        try {
          inner = JSON.parse(decryptPayload(session.sessionKey, frame.payload)) as Record<
            string,
            unknown
          >
        } catch {
          return
        }
        this.handleEncryptedPayload(session, inner)
      })
    } catch {
      this.markSessionDisconnected(session.sessionId)
    }
  }

  private handleEncryptedPayload(session: ActiveSession, payload: Record<string, unknown>): void {
    const type = payload.type as EncryptedPayloadType | undefined
    if (type === 'CHAT_TEXT' && typeof payload.text === 'string') {
      const message = createTextMessage(
        session.sessionId,
        session.peer.deviceId,
        'inbound',
        payload.text,
      )
      if (typeof payload.sentAt === 'string') message.sentAt = payload.sentAt
      if (typeof payload.messageId === 'string') message.id = payload.messageId
      appendMessage(message)
      this.push('p2p:message', message)
      return
    }

    if (
      type === 'FILE_OFFER' &&
      typeof payload.fileId === 'string' &&
      typeof payload.fileName === 'string' &&
      typeof payload.fileSize === 'number'
    ) {
      const mimeType =
        typeof payload.mimeType === 'string' ? payload.mimeType : 'application/octet-stream'
      const path = allocateFilePath(session.peer.deviceId, payload.fileName, payload.fileId)
      const message = createFileMessage(
        session.sessionId,
        session.peer.deviceId,
        'inbound',
        payload.fileName,
        payload.fileSize,
        mimeType,
        path,
      )
      message.id = payload.fileId
      appendMessage(message)
      session.incomingFiles.set(payload.fileId, {
        messageId: payload.fileId,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        path,
        received: 0,
      })
      this.push('p2p:message', message)
      this.sendEncrypted(session, { type: 'FILE_ACCEPT', fileId: payload.fileId })
      return
    }

    if (
      type === 'FILE_CHUNK' &&
      typeof payload.fileId === 'string' &&
      typeof payload.data === 'string'
    ) {
      const incoming = session.incomingFiles.get(payload.fileId)
      if (!incoming) return
      const chunk = Buffer.from(payload.data, 'base64')
      writeFileSync(incoming.path, chunk, { flag: incoming.received === 0 ? 'w' : 'a' })
      incoming.received += chunk.length
      this.push('p2p:fileProgress', {
        sessionId: session.sessionId,
        fileId: payload.fileId,
        transferred: incoming.received,
        total: incoming.fileSize,
      })
      return
    }

    if (type === 'FILE_COMPLETE' && typeof payload.fileId === 'string') {
      const incoming = session.incomingFiles.get(payload.fileId)
      if (!incoming) return
      updateMessage(session.peer.deviceId, payload.fileId, {
        transferStatus: 'complete',
        localPath: incoming.path,
      })
      session.incomingFiles.delete(payload.fileId)
      const messages = getHistory(session.peer.deviceId)
      const message = messages.find((m) => m.id === payload.fileId)
      if (message) this.push('p2p:message', { ...message, transferStatus: 'complete' })
    }
  }

  private sendEncrypted(session: ActiveSession, payload: Record<string, unknown>): void {
    const encrypted = encryptPayload(session.sessionKey, JSON.stringify(payload))
    session.socket.write(encodeWireFrame({ type: 'ENCRYPTED', payload: encrypted }))
  }

  private async streamFileToPeer(
    session: ActiveSession,
    fileId: string,
    localPath: string,
    total: number,
  ): Promise<void> {
    let transferred = 0
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(localPath, { highWaterMark: FILE_CHUNK_SIZE })
      stream.on('data', (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        this.sendEncrypted(session, {
          type: 'FILE_CHUNK',
          fileId,
          data: buf.toString('base64'),
        })
        transferred += buf.length
        this.push('p2p:fileProgress', {
          sessionId: session.sessionId,
          fileId,
          transferred,
          total,
        })
      })
      stream.on('end', () => {
        this.sendEncrypted(session, { type: 'FILE_COMPLETE', fileId })
        resolve()
      })
      stream.on('error', reject)
    })
  }

  private findSessionBySocket(socket: Socket): ActiveSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.socket === socket) return session
    }
    return undefined
  }

  private detachSessionSocket(session: ActiveSession): void {
    session.socket.removeAllListeners('close')
    session.socket.removeAllListeners('error')
    session.socket.removeAllListeners('data')
  }

  private markSessionDisconnected(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.status === 'disconnected') return
    session.status = 'disconnected'
    session.incomingFiles.clear()
    this.detachSessionSocket(session)
    try {
      session.socket.destroy()
    } catch {
      // ignore
    }
    this.push('p2p:sessionDisconnected', this.toSessionInfo(session))
  }

  private removeSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) return
    this.sessions.delete(sessionId)
    this.push('p2p:sessionClosed', { sessionId })
  }

  private toSessionInfo(session: ActiveSession): P2pSessionInfo {
    return {
      sessionId: session.sessionId,
      peer: session.peer,
      status: session.status,
      isInitiator: session.isInitiator,
      hasSecureSession: true,
    }
  }
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    zip: 'application/zip',
  }
  return map[ext] ?? 'application/octet-stream'
}

export const p2pService = new P2PService()
