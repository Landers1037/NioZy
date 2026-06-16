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

export function serializeAttachPtyOffload(
  term: Terminal,
  addon: SerializeAddon,
): { scrollbackText: string; screenText: string } {
  const buffer = term.buffer.active
  const baseY = buffer.baseY
  const endLine = getTerminalContentEndLine(term)
  const scrollbackText =
    baseY > 0 ? addon.serialize({ range: { start: 0, end: baseY - 1 } }) : ''
  const screenText =
    endLine >= baseY ? addon.serialize({ range: { start: baseY, end: endLine } }) : ''
  return { scrollbackText, screenText }
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

export function restoreAttachPtyBuffer(
  term: Terminal,
  bufferText: string,
  format: AttachPtySnapshotFormat = 'plain',
): void {
  if (!bufferText) return
  if (format === 'vt') {
    term.write(bufferText)
    return
  }
  restoreTerminalBufferText(term, bufferText)
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
  restoreTerminalFromOffload(term, scrollbackText, screenText)
}
