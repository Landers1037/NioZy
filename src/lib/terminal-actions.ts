import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import type { CustomConnection } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getBuiltinTerminalOptions,
  getDefaultBuiltinShell,
} from '@/lib/builtin-connection-options'
import type { BuiltinShellType } from '../../electron/shared/builtin-shells'
import type { TerminalCreateOptions } from '../../electron/shared/api-types'
import type { TabTerminalSpawn } from '@/lib/terminal-tab-utils'
import { connectionToTerminalSpawn } from '@/lib/terminal-tab-utils'
import { requestTerminalFocus } from '@/lib/terminal-focus'

type ShellType = BuiltinShellType | 'custom' | 'ssh'

export function toastTerminalError(error: unknown, context?: string): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : i18n.t('toast.terminalStartFailed')
  const sep = i18n.language === 'zh' ? '：' : ': '
  toast.error(context ? `${context}${sep}${message}` : message)
}

function builtinShellOptions(shell: BuiltinShellType): Pick<TerminalCreateOptions, 'shell' | 'args' | 'env'> {
  return getBuiltinTerminalOptions(shell, useAppStore.getState().settings)
}

async function openTerminalTab(
  options: TerminalCreateOptions & { sshConnectionId?: string },
): Promise<void> {
  const { addTerminalTab, setTerminalCwd } = useAppStore.getState()
  const { sshConnectionId, ...createOptions } = options
  const createPayload: TerminalCreateOptions = {
    ...createOptions,
    ...(sshConnectionId ? { sshConnectionId } : {}),
  }
  const result = await getElectronAPI().terminal.create(createPayload)
  setTerminalCwd(result.id, result.cwd)
  const terminalSpawn: TabTerminalSpawn = { create: createPayload, sshConnectionId }
  addTerminalTab({
    id: `tab-${result.id}`,
    type: 'terminal',
    title: result.name,
    terminalId: result.id,
    shell: result.shell,
    sshConnectionId,
    terminalSpawn,
  })
  requestTerminalFocus(result.id)
}

export async function createTerminal(shell?: BuiltinShellType): Promise<void> {
  const resolved =
    shell ?? getDefaultBuiltinShell(useAppStore.getState().settings)
  try {
    await openTerminalTab(builtinShellOptions(resolved))
  } catch (error) {
    toastTerminalError(error)
  }
}

/** 在指定目录下打开新的内置 Shell 终端 Tab（使用设置的默认 Shell，未设置时为 PowerShell） */
export async function openTerminalInDirectory(
  cwd: string,
  shell?: BuiltinShellType,
): Promise<void> {
  const resolved =
    shell ?? getDefaultBuiltinShell(useAppStore.getState().settings)
  try {
    await openTerminalTab({ ...builtinShellOptions(resolved), cwd })
  } catch (error) {
    toastTerminalError(error)
  }
}

export function isExternalConnectionType(
  type: CustomConnection['type'],
): type is 'rdp' | 'putty' {
  return type === 'rdp' || type === 'putty'
}

export async function launchRdpConnection(connection: CustomConnection): Promise<void> {
  if (connection.type !== 'rdp') return
  try {
    const result = await getElectronAPI().rdp.connect(connection.id)
    if (!result.ok) {
      toastTerminalError(new Error(result.error), connection.name)
    }
  } catch (error) {
    toastTerminalError(error, connection.name)
  }
}

export async function launchPuttyConnection(connection: CustomConnection): Promise<void> {
  if (connection.type !== 'putty') return
  try {
    const result = await getElectronAPI().putty.connect(connection.id)
    if (!result.ok) {
      toastTerminalError(new Error(result.error), connection.name)
    }
  } catch (error) {
    toastTerminalError(error, connection.name)
  }
}

export async function launchExternalConnection(connection: CustomConnection): Promise<void> {
  if (connection.type === 'rdp') await launchRdpConnection(connection)
  else if (connection.type === 'putty') await launchPuttyConnection(connection)
}

export async function createConnection(
  shell: ShellType,
  custom?: CustomConnection,
): Promise<void> {
  try {
    if (custom) {
      if (custom.type === 'vnc') {
        useAppStore.getState().addVncTab(custom.id)
        return
      }
      if (isExternalConnectionType(custom.type)) {
        await launchExternalConnection(custom)
        return
      }
      const { create, sshConnectionId } = connectionToTerminalSpawn(custom)
      await openTerminalTab({ ...create, sshConnectionId })
      return
    }

    if (shell === 'custom' || shell === 'ssh') {
      await openTerminalTab({ shell })
      return
    }
    await openTerminalTab(builtinShellOptions(shell))
  } catch (error) {
    toastTerminalError(error, custom?.name)
  }
}
