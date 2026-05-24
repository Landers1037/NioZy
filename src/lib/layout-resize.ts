/** 布局拖拽（侧边栏宽度等）期间暂停终端 refit，避免每帧触发 xterm + IPC resize。 */

let layoutResizing = false
const fitOnResizeEnd = new Set<() => void>()

export function isLayoutResizing(): boolean {
  return layoutResizing
}

export function setLayoutResizing(resizing: boolean): void {
  if (layoutResizing === resizing) return
  layoutResizing = resizing
  if (!resizing) {
    for (const cb of fitOnResizeEnd) {
      cb()
    }
  }
}

export function registerLayoutFitOnResizeEnd(cb: () => void): () => void {
  fitOnResizeEnd.add(cb)
  return () => {
    fitOnResizeEnd.delete(cb)
  }
}
