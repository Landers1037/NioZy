import { useAppStore } from '@/stores/app-store'
import { isWtermEmulator } from '@/lib/terminal-emulator'

export function canToggleTerminalRenderMode(): boolean {
  const settings = useAppStore.getState().settings
  if (!settings) return false
  return !isWtermEmulator(settings)
}

export function toggleTerminalRenderMode(): void {
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings || !canToggleTerminalRenderMode()) return
  const next = settings.terminal.renderer === 'dom' ? 'webgl' : 'dom'
  void patchSettings({
    terminal: { ...settings.terminal, renderer: next },
  })
}
