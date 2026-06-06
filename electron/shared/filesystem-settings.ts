export interface FilesystemCustomOpener {
  id: string
  /** 右键菜单显示名称 */
  label: string
  /** 可执行文件路径 */
  path: string
}

export interface FilesystemSettings {
  /** 开启后在侧栏显示「文件系统」Tab */
  localFilesystemEnabled: boolean
  /** 开启后双击图片可在弹框中预览 */
  imagePreviewEnabled: boolean
  /** 右键显示「通过 VS Code 打开」 */
  openWithVsCode: boolean
  /** 右键显示「通过 Cursor 打开」 */
  openWithCursor: boolean
  /** 留空则自动检测 */
  vsCodePath: string
  cursorPath: string
  customOpeners: FilesystemCustomOpener[]
  /** 开启后在侧栏显示「仓库管理」Tab */
  repoManagementEnabled: boolean
  /** 留空则自动检测 git.exe */
  gitPath: string
}

export const DEFAULT_FILESYSTEM_SETTINGS: FilesystemSettings = {
  localFilesystemEnabled: true,
  imagePreviewEnabled: true,
  openWithVsCode: true,
  openWithCursor: true,
  vsCodePath: '',
  cursorPath: '',
  customOpeners: [],
  repoManagementEnabled: false,
  gitPath: '',
}

export function normalizeFilesystemSettings(value: unknown): FilesystemSettings {
  const v =
    value && typeof value === 'object' ? (value as Partial<FilesystemSettings>) : {}
  const customOpeners = Array.isArray(v.customOpeners)
    ? v.customOpeners
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const o = item as Partial<FilesystemCustomOpener>
          const id = typeof o.id === 'string' ? o.id.trim() : ''
          const label = typeof o.label === 'string' ? o.label.trim() : ''
          const path = typeof o.path === 'string' ? o.path.trim() : ''
          if (!id || !label || !path) return null
          return { id, label, path }
        })
        .filter((x): x is FilesystemCustomOpener => x !== null)
    : DEFAULT_FILESYSTEM_SETTINGS.customOpeners

  return {
    localFilesystemEnabled: v.localFilesystemEnabled !== false,
    imagePreviewEnabled:
      typeof v.imagePreviewEnabled === 'boolean'
        ? v.imagePreviewEnabled
        : DEFAULT_FILESYSTEM_SETTINGS.imagePreviewEnabled,
    openWithVsCode:
      typeof v.openWithVsCode === 'boolean'
        ? v.openWithVsCode
        : DEFAULT_FILESYSTEM_SETTINGS.openWithVsCode,
    openWithCursor:
      typeof v.openWithCursor === 'boolean'
        ? v.openWithCursor
        : DEFAULT_FILESYSTEM_SETTINGS.openWithCursor,
    vsCodePath:
      typeof v.vsCodePath === 'string' ? v.vsCodePath : DEFAULT_FILESYSTEM_SETTINGS.vsCodePath,
    cursorPath:
      typeof v.cursorPath === 'string' ? v.cursorPath : DEFAULT_FILESYSTEM_SETTINGS.cursorPath,
    customOpeners,
    repoManagementEnabled: v.repoManagementEnabled === true,
    gitPath: typeof v.gitPath === 'string' ? v.gitPath : DEFAULT_FILESYSTEM_SETTINGS.gitPath,
  }
}
