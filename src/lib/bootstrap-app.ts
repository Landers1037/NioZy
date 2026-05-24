import { useAppStore } from '@/stores/app-store'
import { installBrowserDevMockIfNeeded } from '@/lib/electron-browser-mock'

/** 在 React 首屏渲染前同步注入 preload 携带的初始设置，避免等待 IPC。 */
export function bootstrapAppFromPreload(): void {
  if (typeof window === 'undefined') return
  installBrowserDevMockIfNeeded()
  const initial = window.electronAPI?.settings?.getInitial?.()
  if (initial) {
    useAppStore.getState().setSettings(initial)
  }
}
