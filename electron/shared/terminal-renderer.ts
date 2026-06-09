export type TerminalRenderer = 'dom' | 'webgl'

export const TERMINAL_RENDERER_VALUES: readonly TerminalRenderer[] = ['dom', 'webgl']

/** 从持久化配置规范化渲染方式（canvas/webgpu 迁移为 webgl） */
export function normalizeTerminalRenderer(value: unknown): TerminalRenderer {
  if (value === 'dom') return 'dom'
  if (value === 'webgl' || value === 'canvas' || value === 'webgpu') return 'webgl'
  return 'webgl'
}
