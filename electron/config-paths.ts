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

export function getStatisticFilePath(): string {
  return join(getConfigDir(), 'statistic.json')
}

/** 终端自定义背景图目录：%USERPROFILE%/.config/NioZy/background */
export function getTerminalBackgroundDir(): string {
  return join(getConfigDir(), 'background')
}

/** 聊天记录与 P2P 设备身份目录：%USERPROFILE%/.config/NioZy/chat */
export function getChatDir(): string {
  return join(getConfigDir(), 'chat')
}

export function ensureConfigDir(): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function ensureChatDir(): void {
  ensureConfigDir()
  const dir = getChatDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}
