import { parentPort } from 'worker_threads'
import si from 'systeminformation'
import type {
  SystemStatsData,
  SystemStatsPollScope,
  SystemStatsWorkerCommand,
  SystemStatsWorkerEvent,
} from '../shared/system-stats-types'

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

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false
let pollScope: SystemStatsPollScope = { liveStats: true, battery: false }
let previous: SystemStatsData = { ...EMPTY_STATS }

function emit(event: SystemStatsWorkerEvent): void {
  parentPort?.postMessage(event)
}

function clearPollTimer(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  polling = false
}

async function buildStats(scope: SystemStatsPollScope, prev: SystemStatsData): Promise<SystemStatsData> {
  const { liveStats, battery } = scope

  let load: Awaited<ReturnType<typeof si.currentLoad>> | undefined
  let mem: Awaited<ReturnType<typeof si.mem>> | undefined
  let batteryInfo: Awaited<ReturnType<typeof si.battery>> | undefined

  const tasks: Promise<void>[] = []
  if (liveStats) {
    tasks.push(
      si.currentLoad().then((value) => {
        load = value
      }),
    )
    tasks.push(
      si.mem().then((value) => {
        mem = value
      }),
    )
  }
  if (battery) {
    tasks.push(
      si.battery().then((value) => {
        batteryInfo = value
      }),
    )
  }
  if (tasks.length > 0) {
    await Promise.all(tasks)
  }

  const totalMem = mem?.total ?? 0
  const usedMem = mem?.used ?? 0
  const hasBattery = batteryInfo?.hasBattery === true
  const pluggedIn = batteryInfo?.acConnected === true
  const activelyCharging = batteryInfo?.isCharging === true

  return {
    date: prev.date,
    time: prev.time,
    cpuPercent: load
      ? Math.min(100, Math.max(0, Math.round(load.currentLoad)))
      : prev.cpuPercent,
    memoryPercent:
      mem && totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : prev.memoryPercent,
    memoryUsedMb: mem ? Math.round(usedMem / 1024 / 1024) : prev.memoryUsedMb,
    memoryTotalMb: mem ? Math.round(totalMem / 1024 / 1024) : prev.memoryTotalMb,
    batteryPercent: batteryInfo
      ? hasBattery
        ? Math.min(100, Math.max(0, Math.round(batteryInfo.percent)))
        : 100
      : prev.batteryPercent,
    batteryCharging: batteryInfo
      ? hasBattery
        ? activelyCharging || pluggedIn
        : false
      : prev.batteryCharging,
    batteryHasBattery: batteryInfo ? hasBattery : prev.batteryHasBattery,
  }
}

async function pollOnce(): Promise<void> {
  if (polling) return
  polling = true
  try {
    previous = await buildStats(pollScope, previous)
    emit({ type: 'stats', data: previous })
  } catch (err) {
    emit({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  } finally {
    polling = false
  }
}

function startPolling(scope: SystemStatsPollScope, intervalMs: number): void {
  clearPollTimer()
  pollScope = scope
  void pollOnce()
  pollTimer = setInterval(() => {
    void pollOnce()
  }, intervalMs)
}

parentPort?.on('message', (command: SystemStatsWorkerCommand) => {
  if (command.type === 'stop') {
    clearPollTimer()
    return
  }
  if (command.type === 'start') {
    startPolling(command.scope, command.intervalMs)
  }
})
