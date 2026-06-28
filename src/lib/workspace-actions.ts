import { useAppStore } from '@/stores/app-store'

export function closeWorkspaceTab(tabId: string): void {
  useAppStore.getState().removeTab(tabId)
}

export function openWorkspaceTab(): void {
  useAppStore.getState().addWorkspaceTab()
}

export function openAgentTab(): void {
  useAppStore.getState().addAgentTab()
}

export function closeAllWorkspaceTabs(): void {
  const tabs = useAppStore.getState().tabs.filter((t) => t.type === 'workspace')
  if (tabs.length === 0) return
  useAppStore.getState().removeTabs(tabs.map((t) => t.id))
}

export function closeAgentTab(): void {
  const tab = useAppStore.getState().tabs.find((item) => item.type === 'agent')
  if (!tab) return
  useAppStore.getState().removeTab(tab.id)
}
