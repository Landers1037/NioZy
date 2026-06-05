import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import type { CustomConnection } from './shared/api-types'
import { resolveShellContextMenuIconPath } from './shell-context-menu-icon'
import { CONNECTION_ARG_PREFIX } from './open-directory'

const execFileAsync = promisify(execFile)

const REGISTRY_KEY_PREFIX = 'NioZy.Conn'

const REGISTRY_TARGET_BASES = [
  'HKCU\\Software\\Classes\\Directory\\shell',
  'HKCU\\Software\\Classes\\Directory\\Background\\shell',
] as const

export function isWindowsConnectionContextMenuSupported(): boolean {
  return process.platform === 'win32'
}

function getExecutablePath(): string {
  return app.getPath('exe')
}

function registryKeyForConnection(connectionId: string): string {
  return `${REGISTRY_KEY_PREFIX}.${connectionId}`
}

function registryBaseKeys(connectionId: string): string[] {
  const keyName = registryKeyForConnection(connectionId)
  return REGISTRY_TARGET_BASES.map((base) => `${base}\\${keyName}`)
}

function buildMenuLabel(connectionName: string): string {
  return `通过 NioZy 打开 ${connectionName}`
}

function buildOpenCommand(exePath: string, connectionId: string): string {
  return `"${exePath}" ${CONNECTION_ARG_PREFIX}${connectionId} "%V"`
}

async function runReg(args: string[]): Promise<void> {
  await execFileAsync('reg', args, { windowsHide: true })
}

function resolveContextMenuIconValue(exePath: string): string {
  const iconPath = resolveShellContextMenuIconPath()
  if (iconPath) return iconPath
  return `${exePath},0`
}

async function registerContextMenuAt(
  baseKey: string,
  exePath: string,
  connectionId: string,
  connectionName: string,
): Promise<void> {
  const command = buildOpenCommand(exePath, connectionId)
  const iconValue = resolveContextMenuIconValue(exePath)
  const label = buildMenuLabel(connectionName)
  await runReg(['add', baseKey, '/ve', '/d', label, '/f'])
  await runReg(['add', baseKey, '/v', 'Icon', '/d', iconValue, '/f'])
  await runReg(['add', `${baseKey}\\command`, '/ve', '/d', command, '/f'])
}

async function unregisterContextMenuAt(baseKey: string): Promise<void> {
  try {
    await runReg(['delete', baseKey, '/f'])
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 1) return
    throw err
  }
}

/** 注册自定义命令的文件夹 / 目录背景右键菜单 */
export async function registerConnectionContextMenu(
  connectionId: string,
  connectionName: string,
): Promise<void> {
  if (!isWindowsConnectionContextMenuSupported()) {
    throw new Error('Connection context menu is only supported on Windows')
  }
  const exePath = getExecutablePath()
  for (const baseKey of registryBaseKeys(connectionId)) {
    await registerContextMenuAt(baseKey, exePath, connectionId, connectionName)
  }
}

/** 移除自定义命令的右键菜单注册 */
export async function unregisterConnectionContextMenu(connectionId: string): Promise<void> {
  if (!isWindowsConnectionContextMenuSupported()) return
  for (const baseKey of registryBaseKeys(connectionId)) {
    await unregisterContextMenuAt(baseKey)
  }
}

function isCommandContextMenuEnabled(conn: CustomConnection): boolean {
  return conn.type === 'command' && conn.shellContextMenu === true
}

/** 根据连接列表变更同步注册表（增删改） */
export async function syncConnectionContextMenus(
  prev: CustomConnection[],
  next: CustomConnection[],
): Promise<void> {
  if (!isWindowsConnectionContextMenuSupported()) return

  const prevEnabled = new Map(
    prev.filter(isCommandContextMenuEnabled).map((c) => [c.id, c] as const),
  )
  const nextEnabled = new Map(
    next.filter(isCommandContextMenuEnabled).map((c) => [c.id, c] as const),
  )

  for (const [id] of prevEnabled) {
    if (!nextEnabled.has(id)) {
      await unregisterConnectionContextMenu(id)
    }
  }

  for (const [id, conn] of nextEnabled) {
    const prevConn = prevEnabled.get(id)
    if (!prevConn || prevConn.name !== conn.name) {
      await registerConnectionContextMenu(id, conn.name)
    }
  }
}

/** 启动时注册所有已启用的自定义命令右键菜单 */
export async function syncAllConnectionContextMenus(
  connections: CustomConnection[],
): Promise<void> {
  if (!isWindowsConnectionContextMenuSupported()) return
  for (const conn of connections) {
    if (isCommandContextMenuEnabled(conn)) {
      await registerConnectionContextMenu(conn.id, conn.name)
    }
  }
}
