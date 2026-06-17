import { toastTerminalError } from '@/lib/terminal-actions'
import { getElectronAPI } from '@/lib/electron-client'
import { useAppStore } from '@/stores/app-store'
import { requestTerminalFocus } from '@/lib/terminal-focus'
import { useTabGroupStore } from '@/stores/tab-group-store'
import type { TabTerminalSpawn } from '@/lib/terminal-tab-utils'
import type { TerminalCreateOptions } from '../../electron/shared/api-types'

/** 在指定项目目录下恢复 Claude Code 会话 */
export async function resumeClaudeCodeSession(
  sessionId: string,
  project?: string,
): Promise<void> {
  const { addTerminalTab, setTerminalCwd } = useAppStore.getState()
  const createPayload: TerminalCreateOptions = {
    shell: 'custom',
    command: 'claude',
    args: ['-r', sessionId],
    ...(project ? { cwd: project } : {}),
  }

  try {
    const result = await getElectronAPI().terminal.create(createPayload)
    setTerminalCwd(result.id, result.cwd)
    const terminalSpawn: TabTerminalSpawn = { create: createPayload }
    const tabId = `tab-${result.id}`
    addTerminalTab({
      id: tabId,
      type: 'terminal',
      title: result.name,
      terminalId: result.id,
      shell: result.shell,
      terminalSpawn,
    })
    useTabGroupStore.getState().addTabToActiveGroupIfAny(tabId)
    requestTerminalFocus(result.id)
  } catch (error) {
    toastTerminalError(error)
  }
}
