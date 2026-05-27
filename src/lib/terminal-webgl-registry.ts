/** 限制同时存在的 WebGL 上下文数量（Chromium 通常上限约 8–16）。 */

const MAX_WEBGL_CONTEXTS = 6

/** terminalId → 最近使用时间戳（LRU） */
const slots = new Map<string, number>()
/** 被 LRU 驱逐时需由对应 TerminalView 释放 WebGL */
const evictHandlers = new Map<string, () => void>()

export function touchWebglSlot(terminalId: string): void {
  if (slots.has(terminalId)) {
    slots.set(terminalId, Date.now())
  }
}

export function registerWebglEvictHandler(
  terminalId: string,
  handler: () => void,
): () => void {
  evictHandlers.set(terminalId, handler)
  return () => {
    evictHandlers.delete(terminalId)
  }
}

function evictLru(excludeId?: string): boolean {
  let oldestId: string | null = null
  let oldestTime = Infinity
  for (const [id, time] of slots) {
    if (id === excludeId) continue
    if (time < oldestTime) {
      oldestTime = time
      oldestId = id
    }
  }
  if (!oldestId) return false
  slots.delete(oldestId)
  evictHandlers.get(oldestId)?.()
  evictHandlers.delete(oldestId)
  return true
}

export function tryAcquireWebglSlot(terminalId: string): boolean {
  if (slots.has(terminalId)) {
    touchWebglSlot(terminalId)
    return true
  }
  while (slots.size >= MAX_WEBGL_CONTEXTS) {
    if (!evictLru(terminalId)) return false
  }
  slots.set(terminalId, Date.now())
  return true
}

export function releaseWebglSlot(terminalId: string): void {
  slots.delete(terminalId)
  evictHandlers.delete(terminalId)
}

export function hasWebglSlot(terminalId: string): boolean {
  return slots.has(terminalId)
}
