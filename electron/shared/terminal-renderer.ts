export type TerminalRenderer = 'dom' | 'canvas' | 'webgl'

export const TERMINAL_RENDERER_VALUES: readonly TerminalRenderer[] = [
  'dom',
  'canvas',
  'webgl',
]

/** 从持久化配置规范化渲染方式（含 webgpu → webgl 迁移） */
export function normalizeTerminalRenderer(value: unknown): TerminalRenderer {
  if (value === 'dom' || value === 'canvas' || value === 'webgl') return value
  if (value === 'webgpu') return 'webgl'
  return 'webgl'
}
