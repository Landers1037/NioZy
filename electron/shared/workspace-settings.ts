export interface WorkspaceSettings {
  /** 开启后在侧栏与新建连接菜单显示「工作区」入口 */
  workspaceEnabled: boolean
  /** 开启后工作区右侧目录树支持切换 Git 工作区 */
  gitWorkspaceEnabled: boolean
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  workspaceEnabled: false,
  gitWorkspaceEnabled: false,
}

export function normalizeWorkspaceSettings(value: unknown): WorkspaceSettings {
  const v = value && typeof value === 'object' ? (value as Partial<WorkspaceSettings>) : {}
  return {
    workspaceEnabled: v.workspaceEnabled === true,
    gitWorkspaceEnabled: v.gitWorkspaceEnabled === true,
  }
}
