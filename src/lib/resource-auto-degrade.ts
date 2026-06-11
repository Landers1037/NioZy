import type { AppSettings } from '../../electron/shared/api-types'
import type { AppMetricsData } from '../../electron/shared/api-types'

/** 本程序各进程 CPU 占用之和超过此值时提示降级 */
export const RESOURCE_AUTO_DEGRADE_CPU_THRESHOLD = 50

export function sumAppCpuPercent(metrics: AppMetricsData): number {
  const total = metrics.processes.reduce((sum, process) => sum + process.cpuPercent, 0)
  return Math.round(total * 10) / 10
}

export function isPerformanceDegraded(settings: AppSettings): boolean {
  return (
    settings.terminal.renderer === 'dom' &&
    settings.experimental.attachPtyRenderMode === true &&
    settings.performance.inactiveTabOptimization === true
  )
}

export type PerformanceDegradePatch = Pick<AppSettings, 'terminal' | 'experimental' | 'performance'>

export function buildPerformanceDegradePatch(settings: AppSettings): PerformanceDegradePatch {
  return {
    terminal: { ...settings.terminal, renderer: 'dom' },
    experimental: { ...settings.experimental, attachPtyRenderMode: true },
    performance: { ...settings.performance, inactiveTabOptimization: true },
  }
}
