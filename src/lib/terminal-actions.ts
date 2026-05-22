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

type ShellType = BuiltinShellType | 'custom' | 'ssh'

function builtinShellOptions(shell: BuiltinShellType): Pick<TerminalCreateOptions, 'shell' | 'args' | 'env'> {
  return getBuiltinTerminalOptions(shell, useAppStore.getState().settings)
}

function toastTerminalError(error: unknown, context?: string): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : i18n.t('toast.terminalStartFailed')
  const sep = i18n.language === 'zh' ? '：' : ': '
  toast.error(context ? `${context}${sep}${message}` : message)
}

async function openTerminalTab(
  options: TerminalCreateOptions & { sshConnectionId?: string },
): Promise<void> {
  const { addTerminalTab, setTerminalCwd } = useAppStore.getState()
  const { sshConnectionId, ...createOptions } = options
  const result = await getElectronAPI().terminal.create(createOptions)
  setTerminalCwd(result.id, result.cwd)
  addTerminalTab({
    id: `tab-${result.id}`,
    type: 'terminal',
    title: result.name,
    terminalId: result.id,
    shell: result.shell,
    sshConnectionId,
  })
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

export async function createConnection(
  shell: ShellType,
  custom?: CustomConnection,
): Promise<void> {
  try {
    if (custom) {
      const args =
        custom.type === 'ssh'
          ? [
              ...(custom.sshPort && custom.sshPort !== 22 ? ['-p', String(custom.sshPort)] : []),
              ...(custom.sshAuth === 'publickey' && custom.sshKeyPath
                ? ['-i', custom.sshKeyPath]
                : []),
              `${custom.sshUser ?? 'user'}@${custom.sshHost ?? custom.command}`,
            ]
          : custom.args

      await openTerminalTab({
        shell: custom.type === 'ssh' ? 'ssh' : 'custom',
        name: custom.name,
        command: custom.type === 'ssh' ? 'ssh' : custom.command,
        args,
        env: custom.env,
        sshConnectionId: custom.type === 'ssh' ? custom.id : undefined,
      })
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
