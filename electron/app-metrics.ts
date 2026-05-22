import { app } from 'electron'
import type { AppMetricsData, AppMetricsProcess } from './shared/api-types'

export function getAppMetricsSnapshot(): AppMetricsData {
  const metrics = app.getAppMetrics()
  const mem = process.memoryUsage()

  const processes: AppMetricsProcess[] = metrics
    .map((m) => ({
      pid: m.pid,
      type: m.type,
      workingSetMb: kbToMb(m.memory?.workingSetSize ?? 0),
      peakWorkingSetMb: kbToMb(m.memory?.peakWorkingSetSize ?? 0),
      cpuPercent: round1(m.cpu?.percentCPUUsage ?? 0),
      sandboxed: m.sandboxed ?? false,
    }))
    .sort((a, b) => b.workingSetMb - a.workingSetMb)

  const totalWorkingSetKb = metrics.reduce(
    (sum, m) => sum + (m.memory?.workingSetSize ?? 0),
    0,
  )
  const totalPeakKb = metrics.reduce(
    (sum, m) => sum + (m.memory?.peakWorkingSetSize ?? 0),
    0,
  )

  return {
    totalWorkingSetMb: kbToMb(totalWorkingSetKb),
    totalPeakWorkingSetMb: kbToMb(totalPeakKb),
    mainHeapUsedMb: bytesToMb(mem.heapUsed),
    mainHeapTotalMb: bytesToMb(mem.heapTotal),
    mainRssMb: bytesToMb(mem.rss),
    processes,
    fetchedAt: new Date().toISOString(),
  }
}

function kbToMb(kb: number): number {
  return Math.round(kb / 1024)
}

function bytesToMb(bytes: number): number {
  return Math.round(bytes / 1024 / 1024)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
