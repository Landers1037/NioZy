import type { AppSettings, LayoutMode } from '../../electron/shared/api-types'

export const LAYOUT_MODE_OPTIONS: { value: LayoutMode; label: string; description: string }[] = [
  {
    value: 'default',
    label: '默认',
    description: '左侧边栏默认展开',
  },
  {
    value: 'focus',
    label: '聚集',
    description: '左侧边栏默认收起，便于聚焦终端',
  },
  {
    value: 'minimal',
    label: '极简',
    description: '隐藏侧栏，顶栏下横向展示终端图标 Tab',
  },
]

export function normalizeLayoutMode(value: unknown): LayoutMode {
  if (value === 'focus' || value === 'minimal') return value
  return 'default'
}

export function getLayoutMode(settings: AppSettings | null | undefined): LayoutMode {
  return normalizeLayoutMode(settings?.layoutMode)
}

export function isMinimalLayout(settings: AppSettings | null | undefined): boolean {
  return getLayoutMode(settings) === 'minimal'
}

export function applyLayoutFromSettings(
  settings: AppSettings,
  setSidebarCollapsed: (collapsed: boolean) => void,
): void {
  const mode = getLayoutMode(settings)
  if (mode === 'minimal') return
  setSidebarCollapsed(mode === 'focus')
}
