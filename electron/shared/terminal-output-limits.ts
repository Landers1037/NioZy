/** 主进程 / 渲染层 pending 缓冲上限（字符数），超出保留尾部最新输出 */
export const TERMINAL_OUTPUT_PENDING_MAX_CHARS = 256 * 1024

/** 单次 IPC terminal:data  payload 上限，避免序列化超大字符串 */
export const TERMINAL_OUTPUT_IPC_CHUNK_CHARS = 64 * 1024

/** 渲染层单帧 term.write 上限 */
export const TERMINAL_WRITE_FLUSH_CHUNK_CHARS = 64 * 1024

/**
 * 追加 PTY 输出并限制总长。先截断 prev 再拼接，避免 prev+data 超过 V8 字符串上限抛错。
 */
export function appendTerminalOutputCapped(
  prev: string,
  data: string,
  maxChars: number,
): string {
  if (!data) return prev
  if (maxChars <= 0) return ''
  const prevTail = prev.length > maxChars ? prev.slice(-maxChars) : prev
  const combined = prevTail + data
  if (combined.length <= maxChars) return combined
  return combined.slice(-maxChars)
}

/** 将 data 拆成不超过 chunkSize 的片段依次回调 */
export function forEachTerminalOutputChunk(
  data: string,
  chunkSize: number,
  emit: (chunk: string) => void,
): void {
  if (!data || chunkSize <= 0) return
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    emit(data.slice(offset, offset + chunkSize))
  }
}
