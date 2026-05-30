import { getElectronAPI } from '@/lib/electron-client'
import { useCommandReplayStore } from '@/stores/command-replay-store'

/** 写入 PTY；录制开启时一并记入命令重放缓冲（含右键粘贴、快捷键粘贴等） */
export function writeTerminalInput(terminalId: string, data: string): void {
  useCommandReplayStore.getState().appendInput(terminalId, data)
  getElectronAPI().terminal.write(terminalId, data)
}
