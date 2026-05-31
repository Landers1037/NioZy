import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { ensureChatDir, getChatDir } from '../config-paths'
import { sanitizeFileName } from './p2p-crypto'
import type { P2pChatMessage, P2pSessionPeer } from '../shared/p2p-types'

const HISTORY_LIMIT = 200

interface PeerMeta {
  deviceId: string
  hostname: string
  displayName: string
  lastIp: string
  lastPort: number
  updatedAt: string
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

export function updatePeerMeta(peer: P2pSessionPeer): void {
  ensurePeerStore(peer.deviceId)
  const meta: PeerMeta = {
    deviceId: peer.deviceId,
    hostname: peer.hostname,
    displayName: peer.displayName,
    lastIp: peer.ip,
    lastPort: peer.port,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(metaPath(peer.deviceId), JSON.stringify(meta, null, 2), 'utf8')
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
