import type { AppTab } from '@/stores/app-store'
import { FilesystemTabItem } from '@/components/layout/FilesystemTabItem'
import { SettingsTabItem } from '@/components/layout/SettingsTabItem'

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
  return <SettingsTabItem {...props} />
}
