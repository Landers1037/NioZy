import type { QuickJSContext, QuickJSWASMModule } from 'quickjs-emscripten'
import {
  disposeQuickJsSandboxModule,
  loadQuickJsSandboxModule,
} from '@/lib/quickjs-sandbox-runtime'
import { wrapJsSandboxEvalCode } from '@/lib/js-sandbox-eval-wrap'
import {
  JS_SANDBOX_EVAL_TIMEOUT_MS,
  JS_SANDBOX_MAX_OUTPUT_CHARS,
  type JsSandboxWorkerCommand,
  type JsSandboxWorkerEvent,
  type JsSandboxLogLevel,
} from '@/lib/js-sandbox-types'

function truncateOutput(text: string): string {
  if (text.length <= JS_SANDBOX_MAX_OUTPUT_CHARS) return text
  return `${text.slice(0, JS_SANDBOX_MAX_OUTPUT_CHARS)}\n…[truncated]`
}

function post(event: JsSandboxWorkerEvent): void {
  self.postMessage(event)
}

let quickJsReady: Promise<QuickJSWASMModule> | null = null

async function ensureQuickJS() {
  quickJsReady ??= loadQuickJsSandboxModule()
  return quickJsReady
}

function installConsole(vm: QuickJSContext, requestId: string): void {
  const consoleHandle = vm.newObject()
  const levels: JsSandboxLogLevel[] = ['log', 'warn', 'error']

  for (const level of levels) {
    const fn = vm.newFunction(level, (...handles) => {
      const parts: string[] = []
      for (const handle of handles) {
        try {
          parts.push(vm.dump(handle))
        } finally {
          handle.dispose()
        }
      }
      post({
        type: 'log',
        requestId,
        level,
        message: truncateOutput(parts.join(' ')),
      })
      return vm.undefined
    })
    vm.setProp(consoleHandle, level, fn)
    fn.dispose()
  }

  vm.setProp(vm.global, 'console', consoleHandle)
  consoleHandle.dispose()
}

async function runEval(requestId: string, code: string): Promise<void> {
  const QuickJS = await ensureQuickJS()
  const vm = QuickJS.newContext()
  const deadline = Date.now() + JS_SANDBOX_EVAL_TIMEOUT_MS

  vm.runtime.setInterruptHandler(() => Date.now() > deadline)

  try {
    installConsole(vm, requestId)
    const result = vm.evalCode(wrapJsSandboxEvalCode(code))
    if (result.error) {
      const message = truncateOutput(vm.dump(result.error))
      result.error.dispose()
      post({ type: 'error', requestId, message })
    } else {
      const dumped = vm.dump(result.value)
      result.value.dispose()
      if (dumped !== 'undefined') {
        post({ type: 'result', requestId, message: truncateOutput(dumped) })
      }
    }
  } catch (err) {
    post({
      type: 'error',
      requestId,
      message: truncateOutput(err instanceof Error ? err.message : String(err)),
    })
  } finally {
    vm.dispose()
    post({ type: 'done', requestId })
  }
}

self.onmessage = (event: MessageEvent<JsSandboxWorkerCommand>) => {
  const cmd = event.data
  switch (cmd.type) {
    case 'init':
      void ensureQuickJS()
        .then(() => post({ type: 'ready' }))
        .catch((err) => {
          post({
            type: 'error',
            requestId: 'init',
            message: err instanceof Error ? err.message : String(err),
          })
        })
      break
    case 'eval':
      void runEval(cmd.requestId, cmd.code)
      break
    case 'dispose':
      disposeQuickJsSandboxModule()
      quickJsReady = null
      break
    default:
      break
  }
}
