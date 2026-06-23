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

/** 控制本轮询采集哪些指标（与状态栏开关一一对应） */
export interface SystemStatsPollScope {
  liveStats: boolean
  battery: boolean
}

export type SystemStatsWorkerCommand =
  | { type: 'start'; scope: SystemStatsPollScope; intervalMs: number }
  | { type: 'stop' }

export type SystemStatsWorkerEvent =
  | { type: 'stats'; data: SystemStatsData }
  | { type: 'error'; message: string }
