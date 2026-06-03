/**
 * 主进程专用：依赖 Node.js `fs`，禁止在渲染进程或 `electron/shared` 中导入。
 *
 * 渲染进程请使用 `electron/shared/logging-settings` 中的类型与常量。
 *
 * 主进程统一日志模块。
 *
 * - `appLog` / `createAppLogger`：按 DEBUG → INFO → WARN → ERROR 输出
 * - 设置中关闭日志时：仅控制台，不写文件
 * - 开启日志时：控制台 + 文件（受配置的最低级别过滤）
 * - 遗留 `console.*` 在开启日志时会被 patch，行为与 appLog 一致
 */
export {
  appLog,
  applyLoggingSettings,
  createAppLogger,
  getDefaultLogFilePath,
  getLoggingConfig,
  isLoggingEnabled,
  logErrorPayload,
  resolveLogFilePath,
  shouldLogAtLevel,
  type AppLogger,
} from './core'

export {
  mainLog,
  settingsLog,
  terminalLog,
  vaultLog,
  copilotLog,
  fsLog,
  updateLog,
  previewLog,
  p2pLog,
} from './loggers'
