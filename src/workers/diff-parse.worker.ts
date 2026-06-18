import { parseDiffLines, type DiffLine } from '@/lib/diff-parse'

export type DiffParseWorkerCommand = {
  type: 'parse'
  requestId: string
  diff: string
}

export type DiffParseWorkerEvent =
  | { type: 'done'; requestId: string; lines: DiffLine[] }
  | { type: 'error'; requestId: string; message: string }

self.onmessage = (event: MessageEvent<DiffParseWorkerCommand>) => {
  const data = event.data
  if (data.type !== 'parse') return
  try {
    const lines = parseDiffLines(data.diff)
    const response: DiffParseWorkerEvent = { type: 'done', requestId: data.requestId, lines }
    self.postMessage(response)
  } catch (err) {
    const response: DiffParseWorkerEvent = {
      type: 'error',
      requestId: data.requestId,
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(response)
  }
}
