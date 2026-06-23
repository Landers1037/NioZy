import { screen, type BrowserWindow } from 'electron'
import type { SavedWindowState } from './shared/window-state'

export type InitialWindowBounds = {
  width: number
  height: number
  x?: number
  y?: number
  startMaximized: boolean
}

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

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

/** 若保存的位置已完全离开所有显示器，则居中到主显示器工作区。 */
export function clampWindowStateToVisibleArea(state: SavedWindowState): SavedWindowState {
  const rect = { x: state.x, y: state.y, width: state.width, height: state.height }
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return (
      rect.x < area.x + area.width &&
      rect.x + rect.width > area.x &&
      rect.y < area.y + area.height &&
      rect.y + rect.height > area.y
    )
  })
  if (visible) return state

  const primary = screen.getPrimaryDisplay().workArea
  const width = Math.min(state.width, primary.width)
  const height = Math.min(state.height, primary.height)
  return {
    ...state,
    width,
    height,
    x: Math.round(primary.x + (primary.width - width) / 2),
    y: Math.round(primary.y + (primary.height - height) / 2),
  }
}

export function getInitialWindowOptions(
  state: SavedWindowState | undefined,
): InitialWindowBounds {
  const defaults: InitialWindowBounds = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    startMaximized: false,
  }
  if (!state) return defaults
  if (state.isMaximized) {
    return { ...defaults, startMaximized: true }
  }
  const clamped = clampWindowStateToVisibleArea(state)
  return {
    width: clamped.width,
    height: clamped.height,
    x: clamped.x,
    y: clamped.y,
    startMaximized: false,
  }
}

/** Electron 42 + Windows 无边框窗口在构造时设置的 bounds 可能不生效，需在 ready-to-show 再次应用。 */
export function applyWindowBounds(win: BrowserWindow, bounds: InitialWindowBounds): void {
  if (bounds.startMaximized) return
  if (bounds.x === undefined || bounds.y === undefined) return
  win.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  })
}

export function windowBoundsMatchSaved(
  win: BrowserWindow,
  saved: SavedWindowState,
): boolean {
  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
  return (
    bounds.width === saved.width &&
    bounds.height === saved.height &&
    bounds.x === saved.x &&
    bounds.y === saved.y
  )
}
