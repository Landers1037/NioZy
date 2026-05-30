export interface CommandReplayItem {
  id: string
  name: string
  /** 写入 PTY 的原始字节序列（可含 \\r、\\n、转义序列等） */
  command: string
}

export function normalizeCommandReplayList(value: unknown): CommandReplayItem[] {
  if (!Array.isArray(value)) return []
  const result: CommandReplayItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const o = item as Partial<CommandReplayItem>
    if (typeof o.id !== 'string' || !o.id.trim()) continue
    if (typeof o.name !== 'string' || typeof o.command !== 'string') continue
    result.push({
      id: o.id.trim(),
      name: o.name.trim() || o.id.trim(),
      command: o.command,
    })
  }
  return result
}
