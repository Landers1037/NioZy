const KILL_BATCH_SIZE = 4

/** 将 PTY kill 分摊到多个事件循环 tick，避免主进程在单次 IPC 风暴中长时间阻塞。 */
export function createTerminalKillQueue(killFn: (id: string) => void) {
  const pending: string[] = []
  const pendingSet = new Set<string>()
  let drainScheduled = false

  function drain() {
    drainScheduled = false
    for (let n = 0; n < KILL_BATCH_SIZE && pending.length > 0; n++) {
      const id = pending.shift()!
      pendingSet.delete(id)
      killFn(id)
    }
    if (pending.length > 0) {
      scheduleDrain()
    }
  }

  function scheduleDrain() {
    if (drainScheduled) return
    drainScheduled = true
    setImmediate(drain)
  }

  return {
    enqueue(id: string) {
      if (!id || pendingSet.has(id)) return
      pendingSet.add(id)
      pending.push(id)
      scheduleDrain()
    },
  }
}
