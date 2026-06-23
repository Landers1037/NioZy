/** 无 Event 时延迟打开弹框（如标题栏按钮直接打开）。 */
export function scheduleOverlayOpen(open: () => void): void {
  window.setTimeout(open, 0)
}
