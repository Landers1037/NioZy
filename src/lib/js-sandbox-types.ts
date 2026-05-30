export const JS_SANDBOX_EVAL_TIMEOUT_MS = 5000
export const JS_SANDBOX_MAX_OUTPUT_CHARS = 8 * 1024
export const JS_SANDBOX_MAX_UI_LINES = 500

export type JsSandboxLogLevel = 'log' | 'warn' | 'error'

export type JsSandboxWorkerCommand =
  | { type: 'init' }
  | { type: 'eval'; requestId: string; code: string }
  | { type: 'dispose' }

export type JsSandboxWorkerEvent =
  | { type: 'ready' }
  | { type: 'log'; requestId: string; level: JsSandboxLogLevel; message: string }
  | { type: 'result'; requestId: string; message: string }
  | { type: 'error'; requestId: string; message: string }
  | {
      type: 'done'
      requestId: string
      output?: Extract<JsSandboxWorkerEvent, { type: 'result' | 'error' }>
    }

export type JsSandboxOutputLine =
  | { id: string; kind: 'input'; text: string }
  | { id: string; kind: 'log'; level: JsSandboxLogLevel; text: string }
  | { id: string; kind: 'result'; text: string }
  | { id: string; kind: 'error'; text: string }
