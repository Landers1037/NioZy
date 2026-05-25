import type { AppTab } from '@/stores/app-store'

export interface TerminalViewProps {
  tab: AppTab
  /** 拆分多 pane 时用 DOM 渲染，避免多 WebGL 上下文 dispose 冲突（仅 Xterm） */
  preferDomRenderer?: boolean
  /** 当前 Tab / pane 处于前台时 refit 并聚焦 */
  isFocused?: boolean
}
