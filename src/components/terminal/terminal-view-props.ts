import type { AppTab } from '@/stores/app-store'
import type { AttachPtyCommittedSession } from '@/stores/attach-pty-session-store'

export interface TerminalViewProps {
  tab: AppTab
  /** 拆分多 pane 时用 DOM 渲染，避免多 WebGL 上下文 dispose 冲突（仅 Xterm） */
  preferDomRenderer?: boolean
  /** 当前 Tab / pane 处于前台时 refit 并聚焦 */
  isFocused?: boolean
  /** Attach-PTY 单例宿主：由 attachSession 驱动 PTY 切换 */
  attachSession?: AttachPtyCommittedSession | null
}
