import { parseDiffLines, type DiffLine } from '@/lib/diff-parse'
import type { DiffParseWorkerCommand, DiffParseWorkerEvent } from '@/workers/diff-parse.worker'

let worker: Worker | null = null
const pending = new Map<
  string,
  { resolve: (lines: DiffLine[]) => void; reject: (err: Error) => void }
>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/diff-parse.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<DiffParseWorkerEvent>) => {
      const data = event.data
      const entry = pending.get(data.requestId)
      if (!entry) return
      pending.delete(data.requestId)
      if (data.type === 'done') {
        entry.resolve(data.lines)
        return
      }
      entry.reject(new Error(data.message))
    }
    worker.onerror = (err) => {
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.reject(new Error(err.message || 'Diff parse worker error'))
      }
    }
  }
  return worker
}

export function parseDiffInWorker(diff: string): Promise<DiffLine[]> {
  if (!diff) return Promise.resolve([])
  const requestId = crypto.randomUUID()
  return new Promise<DiffLine[]>((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    getWorker().postMessage({
      type: 'parse',
      requestId,
      diff,
    } satisfies DiffParseWorkerCommand)
  }).catch(() => parseDiffLines(diff))
}
