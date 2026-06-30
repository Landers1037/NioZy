import { LRUCache } from 'lru-cache'
import type { AttachPtySnapshotFormat } from '@/lib/terminal-buffer-serialize'

export interface AttachPtyOffloadedBuffer {
  scrollbackText: string
  screenText: string
  format?: AttachPtySnapshotFormat
}

/** 最多缓存的 Tab 快照条目数 */
const OFFLOAD_CACHE_MAX_ENTRIES = 256
/** 快照总字节上限（UTF-16 估算） */
const OFFLOAD_CACHE_MAX_BYTES = 64 * 1024 * 1024

function estimateBufferSize(buf: AttachPtyOffloadedBuffer): number {
  const bytes = (buf.scrollbackText.length + buf.screenText.length) * 2
  // lru-cache requires a positive integer; empty snapshots still occupy one entry.
  return bytes > 0 ? bytes : 1
}

/**
 * LRU 侧存储：避免大段 scrollback 驻留在 xterm / zustand 响应式树中。
 * 按条目数 + 总字节双限，超出时 LRU 驱逐最久未访问的快照。
 */
const offloadedBuffers = new LRUCache<string, AttachPtyOffloadedBuffer>({
  max: OFFLOAD_CACHE_MAX_ENTRIES,
  maxSize: OFFLOAD_CACHE_MAX_BYTES,
  sizeCalculation: estimateBufferSize,
})

export function offloadAttachPtyBuffer(tabId: string, buffer: AttachPtyOffloadedBuffer): void {
  offloadedBuffers.set(tabId, buffer)
}

export function peekOffloadedAttachPtyBuffer(tabId: string): AttachPtyOffloadedBuffer | undefined {
  return offloadedBuffers.get(tabId)
}

export function takeOffloadedAttachPtyBuffer(tabId: string): AttachPtyOffloadedBuffer | undefined {
  const buffer = offloadedBuffers.get(tabId)
  if (!buffer) return undefined
  offloadedBuffers.delete(tabId)
  return buffer
}

export function clearOffloadedAttachPtyBuffers(tabIds: string[]): void {
  for (const id of tabIds) {
    offloadedBuffers.delete(id)
  }
}

export function resetOffloadedAttachPtyBuffers(): void {
  offloadedBuffers.clear()
}

export function getOffloadCacheStats(): {
  count: number
  totalBytes: number
  maxBytes: number
  maxEntries: number
} {
  return {
    count: offloadedBuffers.size,
    totalBytes: offloadedBuffers.calculatedSize,
    maxBytes: OFFLOAD_CACHE_MAX_BYTES,
    maxEntries: OFFLOAD_CACHE_MAX_ENTRIES,
  }
}
