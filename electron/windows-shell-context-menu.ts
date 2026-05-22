import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import { resolveShellContextMenuIconPath } from './shell-context-menu-icon'

const execFileAsync = promisify(execFile)

const MENU_KEY_NAME = 'NioZy'
const MENU_LABEL = '使用 NioZy 打开'

const REGISTRY_TARGETS = [
  `HKCU\\Software\\Classes\\Directory\\shell\\${MENU_KEY_NAME}`,
  `HKCU\\Software\\Classes\\Directory\\Background\\shell\\${MENU_KEY_NAME}`,
] as const

export function isWindowsShellContextMenuSupported(): boolean {
  return process.platform === 'win32'
}

function getExecutablePath(): string {
  return app.getPath('exe')
}

function buildOpenCommand(exePath: string): string {
  return `"${exePath}" "%V"`
}

async function runReg(args: string[]): Promise<void> {
  await execFileAsync('reg', args, { windowsHide: true })
}

function resolveContextMenuIconValue(exePath: string): string {
  const iconPath = resolveShellContextMenuIconPath()
  if (iconPath) return iconPath
  // 打包后若未附带 .ico，再回退到 exe 内嵌图标
  return `${exePath},0`
}

async function registerContextMenuAt(baseKey: string, exePath: string): Promise<void> {
  const command = buildOpenCommand(exePath)
  const iconValue = resolveContextMenuIconValue(exePath)
  await runReg(['add', baseKey, '/ve', '/d', MENU_LABEL, '/f'])
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

/** 注册或移除「文件夹 / 目录背景」右键「使用 NioZy 打开」 */
export async function setWindowsShellContextMenu(enabled: boolean): Promise<void> {
  if (!isWindowsShellContextMenuSupported()) {
    throw new Error('Shell context menu is only supported on Windows')
  }

  if (enabled) {
    const exePath = getExecutablePath()
    for (const baseKey of REGISTRY_TARGETS) {
      await registerContextMenuAt(baseKey, exePath)
    }
    return
  }

  for (const baseKey of REGISTRY_TARGETS) {
    await unregisterContextMenuAt(baseKey)
  }
}
