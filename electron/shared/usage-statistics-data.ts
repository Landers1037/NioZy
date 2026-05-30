export interface StatisticCounters {
  usageDurationMs: number
  tabsOpened: number
  tabsClosed: number
  commandsEntered: number
}

export interface UsageStatisticData {
  /** 今日统计对应的本地日期 YYYY-MM-DD */
  todayDate: string
  lifetime: StatisticCounters
  today: StatisticCounters
}

export const EMPTY_STATISTIC_COUNTERS = (): StatisticCounters => ({
  usageDurationMs: 0,
  tabsOpened: 0,
  tabsClosed: 0,
  commandsEntered: 0,
})

export function createEmptyUsageStatisticData(todayDate: string): UsageStatisticData {
  return {
    todayDate,
    lifetime: EMPTY_STATISTIC_COUNTERS(),
    today: EMPTY_STATISTIC_COUNTERS(),
  }
}

export function normalizeStatisticCounters(value: unknown): StatisticCounters {
  const raw = value && typeof value === 'object' ? (value as Partial<StatisticCounters>) : {}
  const n = (v: unknown) => {
    const x = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0
  }
  return {
    usageDurationMs: n(raw.usageDurationMs),
    tabsOpened: n(raw.tabsOpened),
    tabsClosed: n(raw.tabsClosed),
    commandsEntered: n(raw.commandsEntered),
  }
}

export function normalizeUsageStatisticData(value: unknown): UsageStatisticData {
  if (!value || typeof value !== 'object') {
    return createEmptyUsageStatisticData(localTodayDate())
  }
  const raw = value as Partial<UsageStatisticData>
  const todayDate =
    typeof raw.todayDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.todayDate)
      ? raw.todayDate
      : localTodayDate()
  return {
    todayDate,
    lifetime: normalizeStatisticCounters(raw.lifetime),
    today: normalizeStatisticCounters(raw.today),
  }
}

export function localTodayDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 判断终端写入数据是否表示提交一条命令 */
export function isTerminalCommandSubmit(data: string): boolean {
  if (data === '\r' || data === '\n') return true
  const kitty = /^\x1b\[13;(\d+)u$/.exec(data)
  if (kitty) {
    const modifier = Number.parseInt(kitty[1]!, 10)
    // Kitty：仅 Shift 修饰时多为换行
    if (modifier === 2) return false
    return true
  }
  return false
}
