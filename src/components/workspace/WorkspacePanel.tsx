import { useEffect } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { useWorkspaceSession, useWorkspaceStore } from '@/stores/workspace-store'
import { WorkspaceInitView } from '@/components/workspace/WorkspaceInitView'
import { WorkspaceActiveView } from '@/components/workspace/WorkspaceActiveView'

interface WorkspacePanelProps {
  tab: AppTab
}

export function WorkspacePanel({ tab }: WorkspacePanelProps) {
  const session = useWorkspaceSession(tab.id)
  const initHomeDir = useWorkspaceStore((s) => s.initHomeDir)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const isTabActive = activeTabId === tab.id

  useEffect(() => {
    void initHomeDir(tab.id)
  }, [initHomeDir, tab.id])

  if (!session.isStarted) {
    return <WorkspaceInitView tabId={tab.id} />
  }

  return <WorkspaceActiveView tab={tab} isTabActive={isTabActive} />
}
