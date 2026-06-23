import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Worker } from 'worker_threads'
import type {
  SystemStatsData,
  SystemStatsPollScope,
  SystemStatsWorkerCommand,
  SystemStatsWorkerEvent,
} from './shared/system-stats-types'

export type { SystemStatsData, SystemStatsPollScope } from './shared/system-stats-types'

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

function getWorkerPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'workers', 'system-stats-worker.mjs')
}

/**
 * 主进程侧：通过专用 worker 线程轮询系统指标，避免 systeminformation 阻塞主进程事件循环。
 */
export class SystemStats {
  private worker: Worker | null = null
  private workerFailed = false
  private current: SystemStatsData = { ...EMPTY_STATS }
  private onStatsCallback: ((stats: SystemStatsData) => void) | null = null
  private running = false

  getCurrent(): SystemStatsData {
    return this.current
  }

  start(
    callback: (stats: SystemStatsData) => void,
    intervalMs: number,
    scope: SystemStatsPollScope,
  ): void {
    this.stop()
    this.onStatsCallback = callback
    this.running = true
    this.postToWorker({ type: 'start', scope, intervalMs })
  }

  stop(): void {
    this.running = false
    this.onStatsCallback = null
    if (this.worker) {
      this.postToWorker({ type: 'stop' })
    }
  }

  dispose(): void {
    this.stop()
    if (this.worker) {
      void this.worker.terminate()
      this.worker = null
    }
    this.workerFailed = false
  }

  private postToWorker(command: SystemStatsWorkerCommand): void {
    try {
      const worker = this.ensureWorker()
      worker.postMessage(command)
    } catch {
      this.workerFailed = true
    }
  }

  private ensureWorker(): Worker {
    if (this.workerFailed) {
      throw new Error('System stats worker unavailable')
    }
    if (this.worker) return this.worker

    const worker = new Worker(getWorkerPath())
    worker.on('message', (event: SystemStatsWorkerEvent) => {
      if (event.type === 'error') return
      this.current = event.data
      this.onStatsCallback?.(event.data)
    })
    worker.on('error', () => {
      this.workerFailed = true
      if (this.worker) {
        void this.worker.terminate()
        this.worker = null
      }
    })
    worker.on('exit', (code) => {
      this.worker = null
      if (code !== 0) {
        this.workerFailed = true
      }
      if (this.running && !this.workerFailed) {
        // worker 意外退出时尝试恢复轮询
        this.workerFailed = false
      }
    })
    this.worker = worker
    return worker
  }
}
