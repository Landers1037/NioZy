import { useAppStore } from '@/stores/app-store'
import { matchAccelerator } from '@/lib/shortcut-utils'

function isFormTypingTarget(target: HTMLElement | null): boolean {
  if (!target) return false
  // xterm 内部 textarea 应走终端快捷键路径，不能当作普通表单输入
  if (target.closest('.xterm')) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

/** 切换到上一个/下一个终端 Tab；返回 true 表示已处理。 */
export function handleTerminalTabNavigationShortcut(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown') return false

  const { settings, tabs, activeTabId, setActiveTab } = useAppStore.getState()
  const app = settings?.shortcuts.app
  if (!app) return false

  const terminalTabs = tabs.filter((t) => t.type === 'terminal')
  const terminalIndex = terminalTabs.findIndex((t) => t.id === activeTabId)

  if (matchAccelerator(app.prevTerminalTab, event) && terminalIndex > 0) {
    event.preventDefault()
    event.stopPropagation()
    setActiveTab(terminalTabs[terminalIndex - 1]!.id)
    return true
  }

  if (
    matchAccelerator(app.nextTerminalTab, event) &&
    terminalIndex >= 0 &&
    terminalIndex < terminalTabs.length - 1
  ) {
    event.preventDefault()
    event.stopPropagation()
    setActiveTab(terminalTabs[terminalIndex + 1]!.id)
    return true
  }

  return false
}

export { isFormTypingTarget }
