import si from 'systeminformation'

export interface SystemStatsData {
  date: string
  time: string
  cpuPercent: number
  memoryPercent: number
  memoryUsedMb: number
  memoryTotalMb: number
  batteryPercent: number
  batteryCharging: boolean
  batteryHasBattery: boolean
}

const EMPTY_STATS: SystemStatsData = {
  date: '----/--/--',
  time: '--:--:--',
  cpuPercent: 0,
  memoryPercent: 0,
  memoryUsedMb: 0,
  memoryTotalMb: 0,
  batteryPercent: 100,
  batteryCharging: false,
  batteryHasBattery: false,
}

export class SystemStats {
  private interval: ReturnType<typeof setInterval> | null = null
  private polling = false
  private current: SystemStatsData = { ...EMPTY_STATS }

  getCurrent(): SystemStatsData {
    return this.current
  }

  start(callback: (stats: SystemStatsData) => void, ms = 2000): void {
    this.stop()
    const tick = () => {
      void this.poll(callback)
    }
    tick()
    this.interval = setInterval(tick, ms)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.polling = false
  }

  private async poll(callback: (stats: SystemStatsData) => void): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      this.current = await this.buildStats()
      callback(this.current)
    } catch {
      // 保留上一轮数据，避免状态栏闪烁
    } finally {
      this.polling = false
    }
  }

  private async buildStats(): Promise<SystemStatsData> {
    const [load, mem, battery] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.battery(),
    ])

    const totalMem = mem.total
    const usedMem = mem.used
    const cpuPercent = Math.min(100, Math.max(0, Math.round(load.currentLoad)))
    const hasBattery = battery.hasBattery === true
    const batteryPercent = hasBattery
      ? Math.min(100, Math.max(0, Math.round(battery.percent)))
      : 100
    const pluggedIn = battery.acConnected === true
    const activelyCharging = battery.isCharging === true

    const now = new Date()
    return {
      date: formatDate(now),
      time: now.toLocaleTimeString('zh-CN', { hour12: false }),
      cpuPercent,
      memoryPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
      memoryUsedMb: Math.round(usedMem / 1024 / 1024),
      memoryTotalMb: Math.round(totalMem / 1024 / 1024),
      batteryPercent,
      // Windows 在满电插电时常报告 isCharging=false，但 acConnected=true
      batteryCharging: hasBattery ? activelyCharging || pluggedIn : false,
      batteryHasBattery: hasBattery,
    }
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
