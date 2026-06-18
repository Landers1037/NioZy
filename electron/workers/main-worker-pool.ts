import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Worker } from 'worker_threads'
import { randomUUID } from 'crypto'
import type { MainWorkerRequest, MainWorkerResponse, MainWorkerTask } from './main-worker-types'

type PendingTask = {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
}

let worker: Worker | null = null
let workerFailed = false
const pending = new Map<string, PendingTask>()
const queue: Array<{ id: string; task: MainWorkerTask; payload: unknown; resolve: (v: unknown) => void; reject: (e: Error) => void }> = []
let draining = false

function getWorkerPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'workers', 'main-worker.mjs')
}

function ensureWorker(): Worker {
  if (workerFailed) {
    throw new Error('Main worker unavailable')
  }
  if (worker) return worker

  worker = new Worker(getWorkerPath())
  worker.on('message', (response: MainWorkerResponse) => {
    const entry = pending.get(response.id)
    if (!entry) return
    pending.delete(response.id)
    if (response.ok) {
      entry.resolve(response.result)
    } else {
      entry.reject(new Error(response.error))
    }
    drainQueue()
  })
  worker.on('error', (err) => {
    workerFailed = true
    for (const [id, entry] of pending) {
      pending.delete(id)
      entry.reject(err instanceof Error ? err : new Error(String(err)))
    }
    for (const item of queue) {
      item.reject(err instanceof Error ? err : new Error(String(err)))
    }
    queue.length = 0
    worker?.terminate().catch(() => {})
    worker = null
  })
  worker.on('exit', (code) => {
    if (code !== 0 && !workerFailed) {
      workerFailed = true
      const err = new Error(`Main worker exited with code ${code}`)
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.reject(err)
      }
      for (const item of queue) {
        item.reject(err)
      }
      queue.length = 0
    }
    worker = null
  })
  return worker
}

function drainQueue(): void {
  if (draining || queue.length === 0) return
  draining = true
  try {
    const w = ensureWorker()
    while (queue.length > 0 && pending.size < 32) {
      const item = queue.shift()!
      pending.set(item.id, { resolve: item.resolve, reject: item.reject })
      w.postMessage({ id: item.id, task: item.task, payload: item.payload } satisfies MainWorkerRequest)
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    while (queue.length > 0) {
      queue.shift()!.reject(error)
    }
  } finally {
    draining = false
  }
}

export function runMainWorkerTask<T>(task: MainWorkerTask, payload: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = randomUUID()
    queue.push({
      id,
      task,
      payload,
      resolve: (v) => resolve(v as T),
      reject,
    })
    drainQueue()
  })
}

export function disposeMainWorkerPool(): void {
  for (const [id, entry] of pending) {
    pending.delete(id)
    entry.reject(new Error('Worker pool disposed'))
  }
  queue.length = 0
  if (worker) {
    void worker.terminate()
    worker = null
  }
}
