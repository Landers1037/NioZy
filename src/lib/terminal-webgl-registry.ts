/** 限制同时存在的 WebGL 上下文数量（Chromium 通常上限约 8–16）。 */

const MAX_WEBGL_CONTEXTS = 6
const activeSlots = new Set<string>()

export function tryAcquireWebglSlot(terminalId: string): boolean {
  if (activeSlots.has(terminalId)) return true
  if (activeSlots.size >= MAX_WEBGL_CONTEXTS) return false
  activeSlots.add(terminalId)
  return true
}

export function releaseWebglSlot(terminalId: string): void {
  activeSlots.delete(terminalId)
}

export function hasWebglSlot(terminalId: string): boolean {
  return activeSlots.has(terminalId)
}
