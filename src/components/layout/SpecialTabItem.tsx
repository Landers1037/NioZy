import type { AppTab } from '@/stores/app-store'
import { ChatTabItem } from '@/components/layout/ChatTabItem'
import { FilesystemTabItem } from '@/components/layout/FilesystemTabItem'
import { SandboxTabItem } from '@/components/layout/SandboxTabItem'
import { SettingsTabItem } from '@/components/layout/SettingsTabItem'
import { WebviewTabItem } from '@/components/layout/WebviewTabItem'
import { VncTabItem } from '@/components/layout/VncTabItem'

interface SpecialTabItemProps {
  tab: AppTab
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

/** 非终端 Tab（设置、文件系统等） */
export function SpecialTabItem(props: SpecialTabItemProps) {
  if (props.tab.type === 'filesystem') {
    return <FilesystemTabItem {...props} />
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
  return <SettingsTabItem {...props} />
}
