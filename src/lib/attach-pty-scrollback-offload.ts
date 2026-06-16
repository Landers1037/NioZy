import type { AttachPtySnapshotFormat } from '@/lib/terminal-buffer-serialize'

export interface AttachPtyOffloadedBuffer {
  scrollbackText: string
  screenText: string
  format?: AttachPtySnapshotFormat
}

/** 侧存储：避免大段 scrollback 驻留在 xterm / zustand 响应式树中 */
const offloadedBuffers = new Map<string, AttachPtyOffloadedBuffer>()

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
