import type { IpcRenderer } from 'electron'

type Unsubscribe = () => void

/** 同一 IPC channel 只注册一个 ipcRenderer 监听器，再分发给多个订阅者。 */
export function createIpcMultiplex<T extends unknown[]>(
  ipcRenderer: IpcRenderer,
  channel: string,
): (cb: (...args: T) => void) => Unsubscribe {
  const subscribers = new Set<(...args: T) => void>()
  let attached = false

  const ipcHandler = (_event: unknown, ...args: T) => {
    for (const cb of subscribers) {
      cb(...args)
    }
  }

  return (cb) => {
    subscribers.add(cb)
    if (!attached) {
      ipcRenderer.on(channel, ipcHandler)
      attached = true
    }
    return () => {
      subscribers.delete(cb)
      if (subscribers.size === 0 && attached) {
        ipcRenderer.removeListener(channel, ipcHandler)
        attached = false
      }
    }
  }
}
