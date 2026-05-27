export interface PerformanceSettings {
  /**
   * 非活动 Tab 优化：超过 5 分钟无操作的非活动 Tab 卸载终端视图（销毁 xterm/wterm），
   * 切回时重建；PTY 保持连接，输出在主进程缓冲。
   */
  inactiveTabOptimization: boolean
  /**
   * 非活动 Tab 休眠：启用 Chromium 后台节流，并对非活动 Tab 暂停实时推流（保留 PTY）。
   */
  inactiveTabSleep: boolean
  /**
   * 超级省电：仅挂载当前 Tab 的终端视图；Xterm 临时使用 DOM；
   * 非活动 Tab 结束 PTY，切回时按原配置重建。
   */
  superPowerSaving: boolean
}

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  inactiveTabOptimization: false,
  inactiveTabSleep: false,
  superPowerSaving: false,
}

export function normalizePerformanceSettings(
  value: unknown,
  legacyShell?: unknown,
): PerformanceSettings {
  const v = value && typeof value === 'object' ? (value as Partial<PerformanceSettings>) : {}
  const legacy =
    legacyShell && typeof legacyShell === 'object'
      ? (legacyShell as Partial<PerformanceSettings>)
      : {}

  const optimization =
    typeof v.inactiveTabOptimization === 'boolean'
      ? v.inactiveTabOptimization
      : typeof legacy.inactiveTabOptimization === 'boolean'
        ? legacy.inactiveTabOptimization
        : DEFAULT_PERFORMANCE_SETTINGS.inactiveTabOptimization

  const sleep =
    typeof v.inactiveTabSleep === 'boolean'
      ? v.inactiveTabSleep
      : typeof legacy.inactiveTabSleep === 'boolean'
        ? legacy.inactiveTabSleep
        : DEFAULT_PERFORMANCE_SETTINGS.inactiveTabSleep

  const superPowerSaving =
    typeof v.superPowerSaving === 'boolean'
      ? v.superPowerSaving
      : DEFAULT_PERFORMANCE_SETTINGS.superPowerSaving

  return { inactiveTabOptimization: optimization, inactiveTabSleep: sleep, superPowerSaving }
}
