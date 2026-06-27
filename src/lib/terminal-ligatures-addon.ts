import type { IDisposable, Terminal } from '@xterm/xterm'
import type { AppSettings } from '../../electron/shared/api-types'
import { resolveTerminalFontFamilyCSSValue } from '../../electron/shared/terminal-builtin-fonts'
import { normalizeTerminalLigaturesEnabled } from '../../electron/shared/terminal-xterm'

export interface TerminalLigaturesAddonState {
  addon: IDisposable | null
  signature: string
  requestId: number
}

export function createTerminalLigaturesAddonState(): TerminalLigaturesAddonState {
  return {
    addon: null,
    signature: '',
    requestId: 0,
  }
}

export function disposeTerminalLigaturesAddon(state: TerminalLigaturesAddonState): void {
  state.requestId += 1
  state.signature = ''
  state.addon?.dispose()
  state.addon = null
}

export async function syncTerminalLigaturesAddon(
  term: Terminal,
  state: TerminalLigaturesAddonState,
  terminal: AppSettings['terminal'] | undefined,
  enabled: boolean,
): Promise<boolean> {
  const ligaturesEnabled =
    terminal !== undefined &&
    enabled &&
    normalizeTerminalLigaturesEnabled(terminal.ligaturesEnabled)
  const signature =
    terminal !== undefined && ligaturesEnabled
      ? `enabled:${resolveTerminalFontFamilyCSSValue(terminal)}`
      : 'disabled'

  if (state.signature === signature) return false

  state.requestId += 1
  const requestId = state.requestId
  state.signature = signature
  state.addon?.dispose()
  state.addon = null

  if (!ligaturesEnabled) return true

  const { LigaturesAddon } = await import('@xterm/addon-ligatures')
  if (state.requestId !== requestId) return false

  const addon = new LigaturesAddon()
  term.loadAddon(addon)
  if (state.requestId !== requestId) {
    addon.dispose()
    return false
  }

  state.addon = addon
  return true
}
