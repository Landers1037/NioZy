import { useAppStore } from '@/stores/app-store'
import { isWtermEmulator } from '@/lib/terminal-emulator'
import type { TerminalRenderer } from '../../electron/shared/terminal-renderer'

export function canToggleTerminalRenderMode(): boolean {
  const settings = useAppStore.getState().settings
  if (!settings) return false
  return !isWtermEmulator(settings)
}

export function setTerminalRenderer(next: TerminalRenderer): void {
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings || !canToggleTerminalRenderMode()) return
  if (settings.terminal.renderer === next) return
  void patchSettings({
    terminal: { ...settings.terminal, renderer: next },
  })
}

/** @deprecated 请使用 setTerminalRenderer；保留供旧调用方 */
export function toggleTerminalRenderMode(): void {
  const { settings } = useAppStore.getState()
  if (!settings || !canToggleTerminalRenderMode()) return
  const next = settings.terminal.renderer === 'dom' ? 'webgl' : 'dom'
  setTerminalRenderer(next)
}
