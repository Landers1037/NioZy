/** 窗口拖拽等交互期间暂停终端渲染，避免 xterm 占满主线程导致 UI 卡顿 */

const WINDOW_DRAGGING_CLASS = 'window-dragging'

let paused = false
const pauseListeners = new Set<() => void>()
const resumeListeners = new Set<() => void>()

export function isTerminalRenderPaused(): boolean {
  return paused
}

export function setTerminalRenderPaused(value: boolean): void {
  if (paused === value) return
  paused = value
  if (paused) {
    document.documentElement.classList.add(WINDOW_DRAGGING_CLASS)
    for (const listener of pauseListeners) listener()
    return
  }
  document.documentElement.classList.remove(WINDOW_DRAGGING_CLASS)
  for (const listener of resumeListeners) listener()
}

export function onTerminalRenderPaused(listener: () => void): () => void {
  pauseListeners.add(listener)
  return () => {
    pauseListeners.delete(listener)
  }
}

export function onTerminalRenderResumed(listener: () => void): () => void {
  resumeListeners.add(listener)
  return () => {
    resumeListeners.delete(listener)
  }
}
