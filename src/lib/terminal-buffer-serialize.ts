import type { Terminal } from '@xterm/xterm'
import type { SerializeAddon } from '@xterm/addon-serialize'
import {
  getTerminalContentEndLine,
  getTerminalScrollbackText,
  getTerminalScreenText,
  restoreTerminalBufferText,
  restoreTerminalFromOffload,
} from '@/lib/terminal-buffer'

export type AttachPtySnapshotFormat = 'plain' | 'vt'

export function serializeAttachPtyBuffer(term: Terminal, addon: SerializeAddon): string {
  const endLine = getTerminalContentEndLine(term)
  if (endLine < 0) return ''
  return addon.serialize({ range: { start: 0, end: endLine } })
}

export function serializeAttachPtyOffloadPlain(term: Terminal): {
  scrollbackText: string
  screenText: string
} {
  return {
    scrollbackText: getTerminalScrollbackText(term),
    screenText: getTerminalScreenText(term),
  }
}

/** VT 快照须等 write 回调后再续流，避免与 claimStream 在 xterm 队列中交错 */
export function restoreAttachPtyBufferAsync(
  term: Terminal,
  bufferText: string,
  format: AttachPtySnapshotFormat,
  onComplete: () => void,
): void {
  if (!bufferText) {
    onComplete()
    return
  }
  if (format === 'vt') {
    term.write(bufferText, onComplete)
    return
  }
  restoreTerminalBufferText(term, bufferText)
  onComplete()
}

export function restoreAttachPtyOffload(
  term: Terminal,
  scrollbackText: string,
  screenText: string,
  format: AttachPtySnapshotFormat = 'plain',
): void {
  if (format === 'vt') {
    if (scrollbackText) term.write(scrollbackText)
    if (screenText) term.write(screenText)
    return
  }
  if (scrollbackText && screenText) {
    restoreTerminalFromOffload(term, scrollbackText, screenText)
    return
  }
  const merged = scrollbackText
    ? scrollbackText + (screenText ? `\n${screenText}` : '')
    : screenText
  restoreTerminalBufferText(term, merged)
}

export function restoreAttachPtyOffloadAsync(
  term: Terminal,
  scrollbackText: string,
  screenText: string,
  format: AttachPtySnapshotFormat,
  onComplete: () => void,
): void {
  if (format === 'vt') {
    const payload = [scrollbackText, screenText].filter(Boolean).join('')
    if (!payload) {
      onComplete()
      return
    }
    term.write(payload, onComplete)
    return
  }
  restoreAttachPtyOffload(term, scrollbackText, screenText)
  onComplete()
}
