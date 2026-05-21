import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import type { CustomConnection } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import type { TerminalCreateOptions } from '../../electron/shared/api-types'

type ShellType = 'powershell' | 'cmd' | 'pwsh' | 'custom' | 'ssh'

function toastTerminalError(error: unknown, context?: string): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '终端启动失败'
  toast.error(context ? `${context}：${message}` : message)
}

async function openTerminalTab(options: TerminalCreateOptions): Promise<void> {
  const { addTerminalTab } = useAppStore.getState()
  const result = await getElectronAPI().terminal.create(options)
  addTerminalTab({
    id: `tab-${result.id}`,
    type: 'terminal',
    title: result.name,
    terminalId: result.id,
    shell: result.shell,
  })
}

export async function createTerminal(shell: ShellType = 'powershell'): Promise<void> {
  try {
    await openTerminalTab({ shell })
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
      })
      return
    }

    await openTerminalTab({ shell })
  } catch (error) {
    toastTerminalError(error, custom?.name)
  }
}
