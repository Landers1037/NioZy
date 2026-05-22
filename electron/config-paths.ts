import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

/** 配置根目录：%USERPROFILE%/.config/NioZy */
export function getConfigDir(): string {
  const home = process.env.USERPROFILE || homedir()
  return join(home, '.config', 'NioZy')
}

export function getSettingsFilePath(): string {
  return join(getConfigDir(), 'settings.json')
}

export function getTermFilePath(): string {
  return join(getConfigDir(), 'term.json')
}

export function getVaultFilePath(): string {
  return join(getConfigDir(), 'vault.json')
}

export function getVaultKeyFilePath(): string {
  return join(getConfigDir(), 'niozy.key')
}

export function getFontsCacheFilePath(): string {
  return join(getConfigDir(), 'fonts-cache.json')
}

export function ensureConfigDir(): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}
