import type { JsSandboxWorkerCommand, JsSandboxWorkerEvent } from '@/lib/js-sandbox-types'

type PendingEval = {
  resolve: () => void
  reject: (err: Error) => void
  onEvent: (event: JsSandboxWorkerEvent) => void
}

let worker: Worker | null = null
let initPromise: Promise<void> | null = null
let initResolve: (() => void) | null = null
let initReject: ((err: Error) => void) | null = null
const pending = new Map<string, PendingEval>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/js-sandbox.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<JsSandboxWorkerEvent>) => {
      const data = event.data
      if (data.type === 'ready') {
        initResolve?.()
        initResolve = null
        initReject = null
        return
      }
      if (data.type === 'error' && data.requestId === 'init') {
        initReject?.(new Error(data.message))
        initResolve = null
        initReject = null
        initPromise = null
        return
      }

      const requestId = 'requestId' in data ? data.requestId : ''
      const entry = pending.get(requestId)
      if (!entry) return

      if (data.type === 'done') {
        pending.delete(requestId)
        entry.resolve()
        return
      }

      entry.onEvent(data)
    }
    worker.onerror = (err) => {
      initReject?.(new Error(err.message || 'Worker error'))
      initResolve = null
      initReject = null
      initPromise = null
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.reject(new Error(err.message || 'Worker error'))
      }
    }
  }
  return worker
}

export const jsSandboxClient = {
  init(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = new Promise((resolve, reject) => {
      initResolve = resolve
      initReject = reject
      getWorker().postMessage({ type: 'init' } satisfies JsSandboxWorkerCommand)
    })
    return initPromise
  },

  async eval(
    code: string,
    requestId: string,
    onEvent: (event: JsSandboxWorkerEvent) => void,
  ): Promise<void> {
    await this.init()
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject, onEvent })
      getWorker().postMessage({
        type: 'eval',
        requestId,
        code,
      } satisfies JsSandboxWorkerCommand)
    })
  },

  dispose(): void {
    if (worker) {
      worker.postMessage({ type: 'dispose' } satisfies JsSandboxWorkerCommand)
      worker.terminate()
      worker = null
    }
    initPromise = null
    pending.clear()
  },
}
