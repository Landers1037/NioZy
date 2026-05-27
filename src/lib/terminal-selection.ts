import type { Terminal } from '@xterm/xterm'

/** 读取当前终端选中文本（xterm 内部选区或 DOM 原生选区）。 */
export function readTerminalSelectionText(term?: Terminal | null): string {
  const fromXterm = term?.getSelection() ?? ''
  if (fromXterm.length > 0) return fromXterm
  if (typeof window === 'undefined') return ''
  return window.getSelection()?.toString() ?? ''
}
