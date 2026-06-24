export interface MuxTerminalCreateOptions {
  shell: import('../terminal-service').ShellType
  name?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  cols?: number
  rows?: number
  /** 1, 2, or 4 panes in compositor layout */
  paneCount?: 1 | 2 | 4
}

export interface MuxTerminalSession {
  id: string
  name: string
  shell: string
  cwd: string
  paneCount: 1 | 2 | 4
}

export type MuxPaneCount = 1 | 2 | 4

export function normalizeMuxPaneCount(value: unknown): MuxPaneCount {
  const n = typeof value === 'number' ? value : Number(value)
  if (n === 1) return 1
  if (n === 2) return 2
  return 4
}
