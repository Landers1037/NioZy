import { useAppStore } from '@/stores/app-store'

export function closeWorkspaceTab(tabId: string): void {
  useAppStore.getState().removeTab(tabId)
}

export function openWorkspaceTab(): void {
  useAppStore.getState().addWorkspaceTab()
}

export function closeAllWorkspaceTabs(): void {
  const tabs = useAppStore.getState().tabs.filter((t) => t.type === 'workspace')
  if (tabs.length === 0) return
  useAppStore.getState().removeTabs(tabs.map((t) => t.id))
}
