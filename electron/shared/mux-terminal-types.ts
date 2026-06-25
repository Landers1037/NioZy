export type MuxLayoutKind = '1' | '2x1' | '1x2' | '2x2' | 'grid3'

/** @deprecated Use MuxLayoutKind */
export type MuxPaneCount = 1 | 2 | 4

export interface MuxTerminalCreateOptions {
  shell: import('../terminal-service').ShellType
  name?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  cols?: number
  rows?: number
  /** @deprecated Prefer layoutKind */
  paneCount?: MuxPaneCount
  /** Compositor layout: 1, 2x1 (horizontal), 1x2 (vertical), 2x2 */
  layoutKind?: MuxLayoutKind
}

export interface MuxTerminalSession {
  id: string
  name: string
  shell: string
  cwd: string
  paneCount: MuxPaneCount
  layoutKind: MuxLayoutKind
}

export type MuxSplitDirection = 'left' | 'right' | 'up' | 'down'

export interface MuxClosePaneResult {
  ok: boolean
  paneCount: number
  layoutKind: MuxLayoutKind
}

export function normalizeMuxLayoutKind(value: unknown): MuxLayoutKind {
  if (
    value === '1' ||
    value === '2x1' ||
    value === '1x2' ||
    value === '2x2' ||
    value === 'grid3'
  ) {
    return value
  }
  return layoutKindFromPaneCount(normalizeMuxPaneCount(value))
}

export function normalizeMuxPaneCount(value: unknown): MuxPaneCount {
  const n = typeof value === 'number' ? value : Number(value)
  if (n === 1) return 1
  if (n === 2) return 2
  return 4
}

export function layoutKindFromPaneCount(count: MuxPaneCount): MuxLayoutKind {
  if (count === 1) return '1'
  if (count === 2) return '2x1'
  return '2x2'
}

export function paneCountFromLayoutKind(kind: MuxLayoutKind): MuxPaneCount {
  if (kind === '1') return 1
  if (kind === '2x1' || kind === '1x2') return 2
  return 4
}

export function activePaneCountFromLayoutKind(kind: MuxLayoutKind): number {
  if (kind === '1') return 1
  if (kind === '2x1' || kind === '1x2') return 2
  if (kind === 'grid3') return 3
  return 4
}

export const MUX_LAYOUT_OPTIONS: MuxLayoutKind[] = ['1', '2x1', '1x2', '2x2']
