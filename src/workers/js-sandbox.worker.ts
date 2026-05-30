import type { QuickJSContext, QuickJSWASMModule } from 'quickjs-emscripten'
import {
  disposeQuickJsSandboxModule,
  loadQuickJsSandboxModule,
} from '@/lib/quickjs-sandbox-runtime'
import {
  JS_SANDBOX_RESULT_GLOBAL,
  shouldCaptureJsSandboxEvalResult,
  wrapJsSandboxEvalCode,
} from '@/lib/js-sandbox-eval-wrap'
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

function formatEvalResult(dumped: unknown): string {
  if (dumped === undefined) return 'undefined'
  if (typeof dumped === 'string') return dumped
  if (typeof dumped === 'number' || typeof dumped === 'boolean' || dumped === null) {
    return String(dumped)
  }
  if (typeof dumped === 'bigint') return `${dumped}n`
  if (typeof dumped === 'symbol') return dumped.toString()
  try {
    return JSON.stringify(dumped, null, 2) ?? String(dumped)
  } catch {
    return String(dumped)
  }
}

function post(event: JsSandboxWorkerEvent): void {
  self.postMessage(event)
}

let quickJsReady: Promise<QuickJSWASMModule> | null = null
let sandboxContext: QuickJSContext | null = null
let currentRequestId = ''
let evalDeadline = 0

async function ensureQuickJS() {
  quickJsReady ??= loadQuickJsSandboxModule()
  return quickJsReady
}

/** 复用同一 Context；console 只安装一次，避免每次 eval 后 dispose 触发 GC 泄漏断言。 */
function installConsoleOnce(vm: QuickJSContext): void {
  const consoleHandle = vm.newObject()
  const levels: JsSandboxLogLevel[] = ['log', 'warn', 'error']

  for (const level of levels) {
    const fn = vm.newFunction(level, (...argHandles) => {
      const parts = argHandles.map((handle) => vm.dump(handle))
      post({
        type: 'log',
        requestId: currentRequestId,
        level,
        message: truncateOutput(parts.join(' ')),
      })
    })
    vm.setProp(consoleHandle, level, fn)
    fn.dispose()
  }

  vm.setProp(vm.global, 'console', consoleHandle)
  consoleHandle.dispose()
}

async function ensureSandboxContext(): Promise<QuickJSContext> {
  const QuickJS = await ensureQuickJS()
  if (!sandboxContext) {
    sandboxContext = QuickJS.newContext()
    sandboxContext.runtime.setInterruptHandler(() => Date.now() > evalDeadline)
    installConsoleOnce(sandboxContext)
  }
  return sandboxContext
}

function disposeSandboxContext(): void {
  if (sandboxContext) {
    try {
      sandboxContext.dispose()
    } catch {
      // Worker 即将终止时忽略 dispose 断言
    }
    sandboxContext = null
  }
  currentRequestId = ''
}

async function runEval(requestId: string, code: string): Promise<void> {
  const vm = await ensureSandboxContext()
  currentRequestId = requestId
  evalDeadline = Date.now() + JS_SANDBOX_EVAL_TIMEOUT_MS
  const expectsResult = shouldCaptureJsSandboxEvalResult(code)
  const wrapped = wrapJsSandboxEvalCode(code)
  let finalOutput: Extract<JsSandboxWorkerEvent, { type: 'result' | 'error' }> | undefined

  console.log('[sandbox-worker] runEval', requestId, 'expectsResult=', expectsResult)
  console.log('[sandbox-worker] wrapped code:', wrapped)

  try {
    const result = vm.evalCode(wrapped)
    console.log('[sandbox-worker] evalCode done, hasError=', !!result.error)
    if (result.error) {
      const message = truncateOutput(vm.dump(result.error))
      result.error.dispose()
      console.log('[sandbox-worker] error:', message)
      finalOutput = { type: 'error', requestId, message }
    } else {
      result.value.dispose()
      if (expectsResult) {
        const valueHandle = vm.getProp(vm.global, JS_SANDBOX_RESULT_GLOBAL)
        const dumped = vm.dump(valueHandle)
        valueHandle.dispose()
        const message = truncateOutput(formatEvalResult(dumped))
        console.log('[sandbox-worker] result dumped:', JSON.stringify(dumped), 'message:', message)
        if (message !== 'undefined') {
          finalOutput = { type: 'result', requestId, message }
        }
      }
    }
  } catch (err) {
    const message = truncateOutput(err instanceof Error ? err.message : String(err))
    console.log('[sandbox-worker] catch:', message)
    finalOutput = { type: 'error', requestId, message }
  } finally {
    currentRequestId = ''
    console.log('[sandbox-worker] posting done, output=', JSON.stringify(finalOutput))
    post({ type: 'done', requestId, output: finalOutput })
  }
}

self.onmessage = (event: MessageEvent<JsSandboxWorkerCommand>) => {
  const cmd = event.data
  switch (cmd.type) {
    case 'init':
      void ensureSandboxContext()
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
      disposeSandboxContext()
      disposeQuickJsSandboxModule()
      quickJsReady = null
      break
    default:
      break
  }
}
