import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { hostname } from 'os'
import { ensureChatDir, getChatDir } from '../config-paths'

export interface DeviceIdentity {
  deviceId: string
  publicKey: string
  privateKey: string
  hostname: string
}

const DEVICE_FILE = 'device.json'

function getDeviceFilePath(): string {
  return `${getChatDir()}/${DEVICE_FILE}`
}

export function loadOrCreateDeviceIdentity(): DeviceIdentity {
  ensureChatDir()
  const path = getDeviceFilePath()
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<DeviceIdentity>
      if (
        typeof raw.deviceId === 'string' &&
        typeof raw.publicKey === 'string' &&
        typeof raw.privateKey === 'string'
      ) {
        return {
          deviceId: raw.deviceId,
          publicKey: raw.publicKey,
          privateKey: raw.privateKey,
          hostname: typeof raw.hostname === 'string' ? raw.hostname : hostname(),
        }
      }
    } catch {
      // regenerate below
    }
  }

  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  const identity: DeviceIdentity = {
    deviceId: randomUUID(),
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    hostname: hostname(),
  }
  writeFileSync(path, JSON.stringify(identity, null, 2), 'utf8')
  return identity
}

export function importPublicKey(base64: string): Buffer {
  return Buffer.from(base64, 'base64')
}

export function importPrivateKey(base64: string): Buffer {
  return Buffer.from(base64, 'base64')
}

export function generateEphemeralKeyPair(): {
  publicKey: string
  privateKey: Buffer
} {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }),
  }
}

export function computeSharedSecret(privateKeyDer: Buffer, peerPublicKeyDer: Buffer): Buffer {
  return diffieHellman({
    privateKey: createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' }),
    publicKey: createPublicKey({ key: peerPublicKeyDer, format: 'der', type: 'spki' }),
  })
}

export function deriveSessionKey(sharedSecret: Buffer, requestId: string): Buffer {
  return createHash('sha256')
    .update(sharedSecret)
    .update(requestId)
    .update('niozy-p2p-v1')
    .digest()
}

export function computeResumeProof(
  sessionKey: Buffer,
  localDeviceId: string,
  peerDeviceId: string,
): string {
  return createHmac('sha256', sessionKey)
    .update(`${localDeviceId}:${peerDeviceId}`)
    .digest('base64')
}

export function encryptPayload(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptPayload(key: Buffer, payload: string): string {
  const parts = payload.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted payload')
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 200) || 'file'
}
