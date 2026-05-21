import { useAppStore } from '@/stores/app-store'
import type { CustomConnection } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'

type ShellType = 'powershell' | 'cmd' | 'pwsh' | 'custom' | 'ssh'

export async function createTerminal(shell: ShellType = 'powershell'): Promise<void> {
  const { addTerminalTab } = useAppStore.getState()
  const result = await getElectronAPI().terminal.create({ shell })
  const tabId = `tab-${result.id}`
  addTerminalTab({
    id: tabId,
    type: 'terminal',
    title: result.name,
    terminalId: result.id,
    shell: result.shell,
  })
}

export async function createConnection(
  shell: ShellType,
  custom?: CustomConnection,
): Promise<void> {
  const { addTerminalTab } = useAppStore.getState()

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

    const result = await getElectronAPI().terminal.create({
      shell: custom.type === 'ssh' ? 'ssh' : 'custom',
      name: custom.name,
      command: custom.type === 'ssh' ? 'ssh' : custom.command,
      args,
      env: custom.env,
    })
    const tabId = `tab-${result.id}`
    addTerminalTab({
      id: tabId,
      type: 'terminal',
      title: result.name,
      terminalId: result.id,
      shell: result.shell,
    })
    return
  }

  await createTerminal(shell)
}
