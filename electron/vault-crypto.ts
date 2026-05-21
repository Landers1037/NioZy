import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { getVaultKeyFilePath } from './config-paths'

const DEFAULT_KEY_HEX = createHash('md5').update('NioZy').digest('hex')

function readCustomKeyMaterial(): string | null {
  const path = getVaultKeyFilePath()
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf-8').trim()
  return raw.length > 0 ? raw : null
}

/** 32 字节 AES-256 密钥 */
export function getVaultAesKey(): Buffer {
  const custom = readCustomKeyMaterial()
  const material = custom ?? DEFAULT_KEY_HEX
  if (material.length === 32) {
    return Buffer.from(material, 'utf8')
  }
  return createHash('sha256').update(material, 'utf8').digest()
}

export function encryptSecret(plain: string): string {
  const key = getVaultAesKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':')
  if (parts.length !== 3) throw new Error('无效的密文格式')
  const [ivB64, tagB64, dataB64] = parts
  const key = getVaultAesKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function getDefaultKeyHint(): string {
  return DEFAULT_KEY_HEX
}
