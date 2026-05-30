import { existsSync, readFileSync, writeFileSync } from 'fs'
import { ensureConfigDir, getStatisticFilePath } from './config-paths'
import {
  createEmptyUsageStatisticData,
  EMPTY_STATISTIC_COUNTERS,
  isTerminalCommandSubmit,
  localTodayDate,
  normalizeUsageStatisticData,
  type StatisticCounters,
  type UsageStatisticData,
} from './shared/usage-statistics-data'

const TICK_MS = 1000
const PERSIST_MS = 30_000

export class StatisticsStore {
  private data: UsageStatisticData = createEmptyUsageStatisticData(localTodayDate())
  private dirty = false
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private persistTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly isEnabled: () => boolean) {
    this.load()
  }

  load(): void {
    ensureConfigDir()
    const path = getStatisticFilePath()
    if (!existsSync(path)) return
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
      this.data = normalizeUsageStatisticData(raw)
      this.ensureToday()
    } catch {
      this.data = createEmptyUsageStatisticData(localTodayDate())
    }
  }

  getSnapshot(): UsageStatisticData {
    this.ensureToday()
    return structuredClone(this.data)
  }

  clear(): void {
    this.data = createEmptyUsageStatisticData(localTodayDate())
    this.dirty = true
    this.persist()
  }

  recordTabOpen(): void {
    if (!this.isEnabled()) return
    this.bump((c) => {
      c.tabsOpened += 1
    })
  }

  recordTabClose(): void {
    if (!this.isEnabled()) return
    this.bump((c) => {
      c.tabsClosed += 1
    })
  }

  recordCommandFromTerminalWrite(data: string): void {
    if (!this.isEnabled() || !isTerminalCommandSubmit(data)) return
    this.bump((c) => {
      c.commandsEntered += 1
    })
  }

  tickDuration(ms: number): void {
    if (!this.isEnabled() || ms <= 0) return
    this.bump((c) => {
      c.usageDurationMs += ms
    })
  }

  syncPolling(): void {
    if (this.isEnabled()) {
      if (!this.tickTimer) {
        this.tickTimer = setInterval(() => this.tickDuration(TICK_MS), TICK_MS)
      }
      if (!this.persistTimer) {
        this.persistTimer = setInterval(() => this.persist(), PERSIST_MS)
      }
    } else {
      this.stopPolling()
      this.persist()
    }
  }

  stopPolling(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    if (this.persistTimer) {
      clearInterval(this.persistTimer)
      this.persistTimer = null
    }
  }

  dispose(): void {
    this.stopPolling()
    this.persist()
  }

  private bump(mutate: (c: StatisticCounters) => void): void {
    this.ensureToday()
    mutate(this.data.lifetime)
    mutate(this.data.today)
    this.dirty = true
  }

  private ensureToday(): void {
    const key = localTodayDate()
    if (this.data.todayDate === key) return
    this.data.todayDate = key
    this.data.today = EMPTY_STATISTIC_COUNTERS()
    this.dirty = true
  }

  persist(): void {
    if (!this.dirty) return
    ensureConfigDir()
    writeFileSync(getStatisticFilePath(), JSON.stringify(this.data, null, 2), 'utf-8')
    this.dirty = false
  }
}
