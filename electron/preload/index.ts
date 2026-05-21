import { createRequire } from 'node:module'
import type { ElectronAPI, SystemStatsData } from '../shared/api-types'

const require = createRequire(import.meta.url)
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (cb) => {
      const handler = (_: unknown, maximized: boolean) => cb(maximized)
      ipcRenderer.on('window:maximized', handler)
      return () => ipcRenderer.removeListener('window:maximized', handler)
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial),
  },
  system: {
    getStats: () => ipcRenderer.invoke('system:getStats'),
    onStats: (cb) => {
      const handler = (_: unknown, stats: SystemStatsData) => cb(stats)
      ipcRenderer.on('system:stats', handler)
      return () => ipcRenderer.removeListener('system:stats', handler)
    },
  },
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (id, data) => ipcRenderer.send('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
    onData: (cb) => {
      const handler = (_: unknown, id: string, data: string) => cb(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (cb) => {
      const handler = (_: unknown, id: string, code: number) => cb(id, code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    getKeys: () => ipcRenderer.invoke('vault:getKeys'),
    save: (input) => ipcRenderer.invoke('vault:save', input),
    remove: (id) => ipcRenderer.invoke('vault:remove', id),
    resolve: (text) => ipcRenderer.invoke('vault:resolve', text),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
}

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).electronAPI = api
  }
  console.log('[NioZy] preload: electronAPI exposed')
} catch (error) {
  console.error('[NioZy] preload: failed to expose electronAPI', error)
}
