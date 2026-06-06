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

export function getNoteFilePath(): string {
  return join(getConfigDir(), 'note.json')
}

export function getRepoFilePath(): string {
  return join(getConfigDir(), 'repo.json')
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

/** 提醒事项与自定义提醒图目录：%USERPROFILE%/.config/NioZy/reminder */
export function getReminderDir(): string {
  return join(getConfigDir(), 'reminder')
}

export function getReminderFilePath(): string {
  return join(getReminderDir(), 'reminder.json')
}

export function getReminderImagePath(ext: string): string {
  const normalized = ext.replace(/^\./, '').toLowerCase()
  return join(getReminderDir(), `reminder.${normalized}`)
}

export function ensureReminderDir(): void {
  ensureConfigDir()
  const dir = getReminderDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
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
