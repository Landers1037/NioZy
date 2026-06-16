/** 渲染进程：import.meta.env.DEV；主进程 / preload：__ELECTRON_DEV__（构建期替换，便于剔除） */
export function isDevRuntime(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true
  return typeof __ELECTRON_DEV__ !== 'undefined' && __ELECTRON_DEV__
}

export function devLog(...args: unknown[]): void {
  if (isDevRuntime()) console.log(...args)
}

export function devDebug(...args: unknown[]): void {
  if (isDevRuntime()) console.debug(...args)
}

export function devInfo(...args: unknown[]): void {
  if (isDevRuntime()) console.info(...args)
}

export function devWarn(...args: unknown[]): void {
  if (isDevRuntime()) console.warn(...args)
}

/** 调试用 error；生产环境不输出到控制台 */
export function devError(...args: unknown[]): void {
  if (isDevRuntime()) console.error(...args)
}
