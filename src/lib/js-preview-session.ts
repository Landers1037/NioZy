/**
 * js-preview/docx 与 js-preview/excel 在并发 init/preview/destroy 时易出现内部 null 引用。
 * 通过全局 Promise 链串行化所有预览会话的加载与卸载。
 */

let chain: Promise<void> = Promise.resolve()

export function enqueueJsPreview<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn, fn)
  chain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

/** @js-preview/excel 包内遗留的 console.log(workbook, "workbook") 调试输出 */
export function withMutedJsPreviewLibraryLogs<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    if (args.length >= 2 && args[args.length - 1] === 'workbook') return
    originalLog.apply(console, args as Parameters<typeof console.log>)
  }
  return fn().finally(() => {
    console.log = originalLog
  })
}
