import { createAppLogger } from './core'

/** 应用生命周期、窗口、托盘 */
export const mainLog = createAppLogger('Main')

/** 设置读写与副作用 */
export const settingsLog = createAppLogger('Settings')

/** PTY 终端创建与退出 */
export const terminalLog = createAppLogger('Terminal')

/** 存储库变量 */
export const vaultLog = createAppLogger('Vault')

/** AI Copilot 运行时 */
export const copilotLog = createAppLogger('Copilot')

/** 本地文件与外部程序 */
export const fsLog = createAppLogger('FS')

/** 应用更新 */
export const updateLog = createAppLogger('Update')

/** 链接预览 */
export const previewLog = createAppLogger('Preview')

/** 加密聊天（P2P） */
export const p2pLog = createAppLogger('P2P')
