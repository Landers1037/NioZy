import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { ensureChatDir, getChatDir } from '../config-paths'
import { sanitizeFileName } from './p2p-crypto'
import type { P2pChatMessage, P2pSessionInfo, P2pSessionPeer } from '../shared/p2p-types'

const HISTORY_LIMIT = 200

interface PeerMeta {
  deviceId: string
  hostname: string
  displayName: string
  lastIp: string
  lastPort: number
  isInitiator?: boolean
  sessionKeyB64?: string
  hiddenFromSidebar?: boolean
  updatedAt: string
}

export function loadPeerMeta(deviceId: string): PeerMeta | null {
  const mp = metaPath(deviceId)
  if (!existsSync(mp)) return null
  try {
    return JSON.parse(readFileSync(mp, 'utf8')) as PeerMeta
  } catch {
    return null
  }
}

export function saveSessionKey(deviceId: string, sessionKey: Buffer): void {
  ensurePeerStore(deviceId)
  const mp = metaPath(deviceId)
  let meta: PeerMeta
  try {
    meta = existsSync(mp)
      ? (JSON.parse(readFileSync(mp, 'utf8')) as PeerMeta)
      : {
          deviceId,
          hostname: deviceId,
          displayName: deviceId,
          lastIp: '',
          lastPort: 0,
          updatedAt: new Date().toISOString(),
        }
  } catch {
    meta = {
      deviceId,
      hostname: deviceId,
      displayName: deviceId,
      lastIp: '',
      lastPort: 0,
      updatedAt: new Date().toISOString(),
    }
  }
  meta.sessionKeyB64 = sessionKey.toString('base64')
  meta.updatedAt = new Date().toISOString()
  writeFileSync(mp, JSON.stringify(meta, null, 2), 'utf8')
}

export function loadSessionKey(deviceId: string): Buffer | null {
  const meta = loadPeerMeta(deviceId)
  if (!meta?.sessionKeyB64) return null
  try {
    return Buffer.from(meta.sessionKeyB64, 'base64')
  } catch {
    return null
  }
}

export function clearSessionKey(deviceId: string): void {
  const mp = metaPath(deviceId)
  if (!existsSync(mp)) return
  try {
    const meta = JSON.parse(readFileSync(mp, 'utf8')) as PeerMeta
    delete meta.sessionKeyB64
    meta.updatedAt = new Date().toISOString()
    writeFileSync(mp, JSON.stringify(meta, null, 2), 'utf8')
  } catch {
    // ignore
  }
}

export function hasStoredSessionKey(deviceId: string): boolean {
  return loadSessionKey(deviceId) !== null
}

function peerDir(deviceId: string): string {
  return join(getChatDir(), deviceId)
}

function messagesPath(deviceId: string): string {
  return join(peerDir(deviceId), 'messages.jsonl')
}

function metaPath(deviceId: string): string {
  return join(peerDir(deviceId), 'meta.json')
}

function filesDir(deviceId: string): string {
  return join(peerDir(deviceId), 'files')
}

export function ensurePeerStore(deviceId: string): void {
  ensureChatDir()
  const dir = peerDir(deviceId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const files = filesDir(deviceId)
  if (!existsSync(files)) mkdirSync(files, { recursive: true })
}

export function updatePeerMeta(peer: P2pSessionPeer, isInitiator = true): void {
  ensurePeerStore(peer.deviceId)
  let existingInitiator = isInitiator
  let sessionKeyB64: string | undefined
  const mp = metaPath(peer.deviceId)
  if (existsSync(mp)) {
    try {
      const existing = JSON.parse(readFileSync(mp, 'utf8')) as Partial<PeerMeta>
      if (typeof existing.isInitiator === 'boolean') existingInitiator = existing.isInitiator
      if (typeof existing.sessionKeyB64 === 'string') sessionKeyB64 = existing.sessionKeyB64
    } catch {
      // ignore
    }
  }
  const meta: PeerMeta = {
    deviceId: peer.deviceId,
    hostname: peer.hostname,
    displayName: peer.displayName,
    lastIp: peer.ip,
    lastPort: peer.port,
    isInitiator: existingInitiator,
    sessionKeyB64,
    hiddenFromSidebar: false,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(mp, JSON.stringify(meta, null, 2), 'utf8')
}

export function hideConversationFromSidebar(deviceId: string): boolean {
  const mp = metaPath(deviceId)
  if (!existsSync(mp)) return false
  try {
    const meta = JSON.parse(readFileSync(mp, 'utf8')) as PeerMeta
    meta.hiddenFromSidebar = true
    meta.updatedAt = new Date().toISOString()
    writeFileSync(mp, JSON.stringify(meta, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

export function listSavedConversations(options?: { includeHidden?: boolean }): P2pSessionInfo[] {
  ensureChatDir()
  const root = getChatDir()
  let entries: string[] = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }

  const conversations: P2pSessionInfo[] = []
  for (const deviceId of entries) {
    const mp = metaPath(deviceId)
    if (!existsSync(mp)) continue
    try {
      const meta = JSON.parse(readFileSync(mp, 'utf8')) as PeerMeta
      if (meta.hiddenFromSidebar && !options?.includeHidden) continue
      conversations.push({
        sessionId: meta.deviceId,
        peer: {
          deviceId: meta.deviceId,
          hostname: meta.hostname,
          displayName: meta.displayName,
          ip: meta.lastIp,
          port: meta.lastPort,
        },
        status: 'disconnected',
        isInitiator: meta.isInitiator ?? true,
        hasSecureSession: Boolean(meta.sessionKeyB64),
      })
    } catch {
      // skip
    }
  }
  return conversations.sort((a, b) => {
    const aPath = metaPath(a.sessionId)
    const bPath = metaPath(b.sessionId)
    try {
      const aMeta = JSON.parse(readFileSync(aPath, 'utf8')) as PeerMeta
      const bMeta = JSON.parse(readFileSync(bPath, 'utf8')) as PeerMeta
      return bMeta.updatedAt.localeCompare(aMeta.updatedAt)
    } catch {
      return 0
    }
  })
}

export function removeSavedConversation(deviceId: string): void {
  const dir = peerDir(deviceId)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function listKnownPeers(): P2pSessionPeer[] {
  ensureChatDir()
  const root = getChatDir()
  let entries: string[] = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }

  const peers: P2pSessionPeer[] = []
  for (const deviceId of entries) {
    if (deviceId === 'device.json') continue
    const mp = metaPath(deviceId)
    if (!existsSync(mp)) continue
    try {
      const meta = JSON.parse(readFileSync(mp, 'utf8')) as PeerMeta
      peers.push({
        deviceId: meta.deviceId,
        hostname: meta.hostname,
        displayName: meta.displayName,
        ip: meta.lastIp,
        port: meta.lastPort,
      })
    } catch {
      // skip
    }
  }
  return peers
}

export function appendMessage(message: P2pChatMessage): void {
  ensurePeerStore(message.peerDeviceId)
  appendFileSync(messagesPath(message.peerDeviceId), `${JSON.stringify(message)}\n`, 'utf8')
}

export function updateMessage(peerDeviceId: string, messageId: string, patch: Partial<P2pChatMessage>): void {
  const messages = readAllMessages(peerDeviceId)
  const next = messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m))
  writeFileSync(messagesPath(peerDeviceId), next.map((m) => JSON.stringify(m)).join('\n') + (next.length ? '\n' : ''), 'utf8')
}

function readAllMessages(peerDeviceId: string): P2pChatMessage[] {
  const path = messagesPath(peerDeviceId)
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf8')
  const lines = raw.split('\n').filter(Boolean)
  const messages: P2pChatMessage[] = []
  for (const line of lines) {
    try {
      messages.push(JSON.parse(line) as P2pChatMessage)
    } catch {
      // skip
    }
  }
  return messages
}

export function getHistory(peerDeviceId: string, limit = HISTORY_LIMIT): P2pChatMessage[] {
  const messages = readAllMessages(peerDeviceId)
  return messages.slice(-limit)
}

export function getFullHistory(peerDeviceId: string): P2pChatMessage[] {
  return readAllMessages(peerDeviceId)
}

export function clearPeerHistory(peerDeviceId: string): void {
  const msgFile = messagesPath(peerDeviceId)
  if (existsSync(msgFile)) writeFileSync(msgFile, '', 'utf8')

  const dir = filesDir(peerDeviceId)
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { force: true })
  }
}

export function allocateFilePath(peerDeviceId: string, fileName: string, messageId: string): string {
  ensurePeerStore(peerDeviceId)
  const safe = sanitizeFileName(fileName)
  return join(filesDir(peerDeviceId), `${messageId}-${safe}`)
}

export function createTextMessage(
  sessionId: string,
  peerDeviceId: string,
  direction: P2pChatMessage['direction'],
  text: string,
): P2pChatMessage {
  return {
    id: randomUUID(),
    sessionId,
    peerDeviceId,
    direction,
    type: 'text',
    sentAt: new Date().toISOString(),
    text,
  }
}

export function createFileMessage(
  sessionId: string,
  peerDeviceId: string,
  direction: P2pChatMessage['direction'],
  fileName: string,
  fileSize: number,
  mimeType: string,
  localPath?: string,
): P2pChatMessage {
  const isImage = mimeType.startsWith('image/')
  return {
    id: randomUUID(),
    sessionId,
    peerDeviceId,
    direction,
    type: isImage ? 'image' : 'file',
    sentAt: new Date().toISOString(),
    fileName,
    fileSize,
    mimeType,
    localPath,
    transferStatus: direction === 'outbound' ? 'pending' : 'transferring',
  }
}
