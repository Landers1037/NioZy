import { getElectronAPI } from '@/lib/electron-client'

const KILL_BATCH_SIZE = 4

/**
 * 在下一帧分批向主进程发送 terminal:kill，避免与 Tab 移除同一同步栈内堆积 IPC。
 */
export function scheduleTerminalKills(terminalIds: string[]): void {
  const unique = [...new Set(terminalIds.filter(Boolean))]
  if (unique.length === 0) return

  const api = getElectronAPI()
  let index = 0

  const runBatch = () => {
    const end = Math.min(index + KILL_BATCH_SIZE, unique.length)
    for (; index < end; index++) {
      api.terminal.kill(unique[index])
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
