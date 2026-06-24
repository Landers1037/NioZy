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
import { useTabGroupStore } from '@/stores/tab-group-store'
import { isSshDynamicPasswordEnabled } from '../../electron/ssh-auth'
import { promptSshDynamicPassword } from '@/lib/ssh-dynamic-password-prompt'
import { getSshConnection } from '@/lib/ssh-connection'
import { isMuxCoreEnabled } from '@/lib/mux-terminal-render'

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
  const { sshConnectionId, sshDynamicPasswordSuffix, ...createRest } = options
  const createPayload: TerminalCreateOptions = {
    ...createRest,
    ...(sshConnectionId ? { sshConnectionId } : {}),
    ...(sshDynamicPasswordSuffix !== undefined ? { sshDynamicPasswordSuffix } : {}),
  }
  const result = await getElectronAPI().terminal.create(createPayload)
  setTerminalCwd(result.id, result.cwd)
  const terminalSpawn: TabTerminalSpawn = {
    create: {
      ...createPayload,
      sshDynamicPasswordSuffix: undefined,
    },
    sshConnectionId,
  }
  const tabId = `tab-${result.id}`
  addTerminalTab({
    id: tabId,
    type: 'terminal',
    title: result.name,
    terminalId: result.id,
    shell: result.shell,
    sshConnectionId,
    terminalSpawn,
  })
  useTabGroupStore.getState().addTabToActiveGroupIfAny(tabId)
  requestTerminalFocus(result.id)
}

export async function createTerminal(shell?: BuiltinShellType): Promise<void> {
  const settings = useAppStore.getState().settings
  const resolved = shell ?? getDefaultBuiltinShell(settings)
  if (isMuxCoreEnabled(settings)) {
    const { createMuxTerminal } = await import('@/lib/mux-terminal-actions')
    await createMuxTerminal(resolved)
    return
  }
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

/** 在指定目录下打开已保存的自定义命令连接 */
export async function openConnectionInDirectory(
  connectionId: string,
  cwd: string,
): Promise<void> {
  const conn = useAppStore
    .getState()
    .settings?.connections.find((c) => c.id === connectionId && c.type === 'command')
  if (!conn) {
    toastTerminalError(new Error(i18n.t('toast.connectionNotFound')))
    return
  }
  try {
    const { create } = connectionToTerminalSpawn(conn)
    await openTerminalTab({ ...create, cwd })
  } catch (error) {
    toastTerminalError(error, conn.name)
  }
}

export async function handleOpenDirectoryPayload(payload: {
  directory: string
  connectionId?: string
}): Promise<void> {
  if (payload.connectionId) {
    await openConnectionInDirectory(payload.connectionId, payload.directory)
    return
  }
  await openTerminalInDirectory(payload.directory)
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

/** 若连接启用动态密码则弹框收集后缀；取消时返回 null */
export async function resolveSshDynamicPasswordSuffix(
  connection: CustomConnection,
): Promise<string | null | undefined> {
  if (!isSshDynamicPasswordEnabled(connection)) return undefined
  return promptSshDynamicPassword(connection.name)
}

/** 为 terminal.create 补全动态密码后缀；取消时返回 null */
export async function applySshDynamicPasswordToCreateOptions(
  create: TerminalCreateOptions,
  sshConnectionId?: string,
): Promise<TerminalCreateOptions | null> {
  const { settings } = useAppStore.getState()
  const conn = getSshConnection(settings, sshConnectionId ?? create.sshConnectionId)
  if (!conn) return create
  const suffix = await resolveSshDynamicPasswordSuffix(conn)
  if (suffix === null) return null
  if (suffix === undefined) return create
  return { ...create, sshDynamicPasswordSuffix: suffix }
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
      const createWithDynamic = await applySshDynamicPasswordToCreateOptions(
        create,
        sshConnectionId,
      )
      if (!createWithDynamic) return
      await openTerminalTab({ ...createWithDynamic, sshConnectionId })
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
