import { memo } from 'react'
import type { AppTab } from '@/stores/app-store'
import { ChatTabItem } from '@/components/layout/ChatTabItem'
import { FilesystemTabItem } from '@/components/layout/FilesystemTabItem'
import { RepoTabItem } from '@/components/layout/RepoTabItem'
import { SessionTabItem } from '@/components/layout/SessionTabItem'
import { WorkspaceTabItem } from '@/components/layout/WorkspaceTabItem'
import { SandboxTabItem } from '@/components/layout/SandboxTabItem'
import { SettingsTabItem } from '@/components/layout/SettingsTabItem'
import { WebviewTabItem } from '@/components/layout/WebviewTabItem'
import { VncTabItem } from '@/components/layout/VncTabItem'
import { ExcalidrawTabItem } from '@/components/layout/ExcalidrawTabItem'
import { DrawioTabItem } from '@/components/layout/DrawioTabItem'

interface SpecialTabItemProps {
  tab: AppTab
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

function specialTabItemPropsEqual(
  prev: SpecialTabItemProps,
  next: SpecialTabItemProps,
): boolean {
  if (prev.isActive !== next.isActive) return false
  if (prev.collapsed !== next.collapsed) return false
  if (prev.iconOnly !== next.iconOnly) return false
  return prev.tab === next.tab
}

/** 非终端 Tab（设置、文件系统等） */
export const SpecialTabItem = memo(function SpecialTabItem(props: SpecialTabItemProps) {
  if (props.tab.type === 'filesystem') {
    return <FilesystemTabItem {...props} />
  }
  if (props.tab.type === 'repo') {
    return <RepoTabItem {...props} />
  }
  if (props.tab.type === 'session') {
    return <SessionTabItem {...props} />
  }
  if (props.tab.type === 'workspace') {
    return <WorkspaceTabItem {...props} />
  }
  if (props.tab.type === 'chat') {
    return <ChatTabItem {...props} />
  }
  if (props.tab.type === 'sandbox') {
    return <SandboxTabItem {...props} />
  }
  if (props.tab.type === 'webview') {
    return <WebviewTabItem {...props} />
  }
  if (props.tab.type === 'vnc') {
    return <VncTabItem {...props} />
  }
  if (props.tab.type === 'excalidraw') {
    return <ExcalidrawTabItem {...props} />
  }
  if (props.tab.type === 'drawio') {
    return <DrawioTabItem {...props} />
  }
  return <SettingsTabItem {...props} />
}, specialTabItemPropsEqual)

SpecialTabItem.displayName = 'SpecialTabItem'
