/** 主进程 / 渲染层 pending 缓冲上限（字符数），超出保留尾部最新输出 */
export const TERMINAL_OUTPUT_PENDING_MAX_CHARS = 1024 * 1024

/** 单次 IPC terminal:data  payload 上限，避免序列化超大字符串 */
export const TERMINAL_OUTPUT_IPC_CHUNK_CHARS = 64 * 1024

/** 渲染层单帧 term.write 上限 */
export const TERMINAL_WRITE_FLUSH_CHUNK_CHARS = 64 * 1024

const OSC_START = '\x1b]'

/** 从 fromIndex 起查找 OSC 序列结束位置（BEL 或 ST），未结束返回 -1 */
export function findOscSequenceEnd(data: string, fromIndex = 0): number {
  const start = data.indexOf(OSC_START, fromIndex)
  if (start < 0) return -1

  for (let pos = start + 2; pos < data.length; pos++) {
    const code = data.charCodeAt(pos)
    if (code === 0x07) return pos + 1
    if (code === 0x1b && data.charCodeAt(pos + 1) === 0x5c) return pos + 2
  }
  return -1
}

/**
 * 计算安全分块结束位置：避免在 OSC（如 iTerm IIP 1337）序列中间切断。
 * 若 maxChars 落在 OSC 内部，则扩展到 OSC 结束。
 */
export function findSafeTerminalOutputChunkEnd(
  data: string,
  offset: number,
  maxChunk: number,
): number {
  const remaining = data.length - offset
  if (remaining <= 0) return offset
  if (remaining <= maxChunk) return data.length

  const tentative = offset + maxChunk
  const oscStart = data.lastIndexOf(OSC_START, tentative - 1)
  if (oscStart < offset) return tentative

  const oscEnd = findOscSequenceEnd(data, oscStart)
  if (oscEnd < 0) {
    // 不完整 OSC：保留到 buffer 末尾，等待后续数据拼接
    return data.length
  }
  if (oscEnd > tentative) return oscEnd
  return tentative
}

/** 截断后去掉开头处被切断的 OSC 残留（例如 base64 片段） */
function dropLeadingOscFragment(text: string): string {
  const firstOsc = text.indexOf(OSC_START)
  if (firstOsc > 0) return text.slice(firstOsc)
  return text
}

/**
 * 追加 PTY 输出并限制总长。先截断 prev 再拼接，避免 prev+data 超过 V8 字符串上限抛错。
 * 截断时尽量避免切断 OSC 图像序列。
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

  let truncated = combined.slice(-maxChars)
  truncated = dropLeadingOscFragment(truncated)

  // 若截断后仍以不完整 OSC 开头且后面还有普通文本，去掉该 OSC 残留
  if (truncated.startsWith(OSC_START) && findOscSequenceEnd(truncated, 0) < 0) {
    // 保留不完整 OSC，等待后续 chunk 补全
    return truncated
  }

  return truncated
}

/** 将 data 拆成不超过 chunkSize 的片段依次回调（不在 OSC 序列中间切断） */
export function forEachTerminalOutputChunk(
  data: string,
  chunkSize: number,
  emit: (chunk: string) => void,
): void {
  if (!data || chunkSize <= 0) return
  let offset = 0
  while (offset < data.length) {
    const end = findSafeTerminalOutputChunkEnd(data, offset, chunkSize)
    if (end <= offset) break
    emit(data.slice(offset, end))
    offset = end
  }
}
