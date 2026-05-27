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
}

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  inactiveTabOptimization: false,
  inactiveTabSleep: false,
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

  return { inactiveTabOptimization: optimization, inactiveTabSleep: sleep }
}
