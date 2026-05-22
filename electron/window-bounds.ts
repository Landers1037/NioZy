import type { BrowserWindow } from 'electron'
import type { SavedWindowState } from './shared/window-state'

export function captureWindowState(win: BrowserWindow): SavedWindowState {
  const isMaximized = win.isMaximized()
  const bounds = isMaximized ? win.getNormalBounds() : win.getBounds()
  return {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized,
  }
}

export function getInitialWindowOptions(
  state: SavedWindowState | undefined,
): { width: number; height: number; x?: number; y?: number; startMaximized: boolean } {
  const defaults = { width: 1280, height: 800, startMaximized: false }
  if (!state) return defaults
  if (state.isMaximized) {
    return { ...defaults, startMaximized: true }
  }
  return {
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    startMaximized: false,
  }
}
