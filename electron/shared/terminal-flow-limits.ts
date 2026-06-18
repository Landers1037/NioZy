/** 主进程单次推送到渲染层的 chunk 上限（字符数，UTF-16） */
export const TERMINAL_FLOW_MAX_CHUNK_CHARS = 100 * 1024

/** 未 ack 在途数据上限 = maxChunk × factor（与 Tabby PTYDataQueue 一致） */
export const TERMINAL_FLOW_MAX_UNACKED_FACTOR = 5
export const TERMINAL_FLOW_MAX_UNACKED_CHARS =
  TERMINAL_FLOW_MAX_CHUNK_CHARS * TERMINAL_FLOW_MAX_UNACKED_FACTOR

/** 渲染层 FlowControl：pending write callback 水位线 */
export const TERMINAL_FLOW_LOW_WATERMARK = 5
export const TERMINAL_FLOW_HIGH_WATERMARK = 10

/** 累计写入超过该阈值时使用 term.write(callback) 并计入 pending */
export const TERMINAL_FLOW_BYTES_THRESHOLD = 128 * 1024
