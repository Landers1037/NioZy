import { getElectronAPI } from '@/lib/electron-client'

const KILL_BATCH_SIZE = 4

function scheduleKillBatch(
  ids: string[],
  kill: (id: string) => void,
): void {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return

  let index = 0
  const runBatch = () => {
    const end = Math.min(index + KILL_BATCH_SIZE, unique.length)
    for (; index < end; index++) {
      kill(unique[index]!)
    }
    if (index < unique.length) {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(runBatch, { timeout: 50 })
      } else {
        setTimeout(runBatch, 0)
      }
    }
  }
  requestAnimationFrame(runBatch)
}

/**
 * 在下一帧分批向主进程发送 kill，避免与 Tab 移除同一同步栈内堆积 IPC。
 */
export function scheduleTerminalKills(terminalIds: string[], muxSessionIds: string[] = []): void {
  const api = getElectronAPI()
  scheduleKillBatch(terminalIds, (id) => api.terminal.kill(id))
  scheduleKillBatch(muxSessionIds, (id) => api.muxTerminal.kill(id))
}
