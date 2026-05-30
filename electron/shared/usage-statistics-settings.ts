export interface UsageStatisticsSettings {
  /** 是否采集并持久化使用统计 */
  enabled: boolean
  /** 是否在顶栏搜索按钮左侧显示统计入口 */
  showStatusBar: boolean
}

export const DEFAULT_USAGE_STATISTICS_SETTINGS: UsageStatisticsSettings = {
  enabled: false,
  showStatusBar: false,
}

export function normalizeUsageStatisticsSettings(
  stored: Partial<UsageStatisticsSettings> | undefined,
): UsageStatisticsSettings {
  return {
    enabled:
      typeof stored?.enabled === 'boolean'
        ? stored.enabled
        : DEFAULT_USAGE_STATISTICS_SETTINGS.enabled,
    showStatusBar:
      typeof stored?.showStatusBar === 'boolean'
        ? stored.showStatusBar
        : DEFAULT_USAGE_STATISTICS_SETTINGS.showStatusBar,
  }
}
