import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopPetSpriteConfig } from '../pet-store'
import type { PetReminderListItemDto } from '../shared/pet-reminder-dto'
import type { ReminderDuePayload } from '../shared/reminder-data'
import type { PetUiLabels } from '../shared/pet-ui-labels'

export interface PetElectronAPI {
  ready: () => void
  pointerDown: () => void
  pointerMove: () => void
  pointerUp: () => void
  toggleMainWindow: () => void
  showMenu: () => void
  getSpriteConfig: () => Promise<DesktopPetSpriteConfig>
  getLabels: () => Promise<PetUiLabels>
  listReminders: () => Promise<PetReminderListItemDto[]>
  dismissReminders: (ids: string[]) => Promise<void>
  snoozeReminders: (ids: string[], minutes: number) => Promise<void>
  setWindowCompact: () => void
  setWindowReminderList: () => void
  setWindowDueAlert: () => void
  setWindowReminderAndDue: () => void
  /** 提醒面板展开时关闭后台节流，收起后恢复 */
  setOverlayInteractive: (active: boolean) => void
  onOpenReminders: (callback: () => void) => () => void
  onReminderDue: (callback: (payload: ReminderDuePayload) => void) => () => void
}

const api: PetElectronAPI = {
  ready: () => ipcRenderer.send('pet:ready'),
  pointerDown: () => ipcRenderer.send('pet:pointerDown'),
  pointerMove: () => ipcRenderer.send('pet:pointerMove'),
  pointerUp: () => ipcRenderer.send('pet:pointerUp'),
  toggleMainWindow: () => ipcRenderer.send('pet:toggleMain'),
  showMenu: () => ipcRenderer.send('pet:showMenu'),
  getSpriteConfig: () => ipcRenderer.invoke('pet:getSpriteConfig') as Promise<DesktopPetSpriteConfig>,
  getLabels: () => ipcRenderer.invoke('pet:getLabels') as Promise<PetUiLabels>,
  listReminders: () => ipcRenderer.invoke('pet:listReminders') as Promise<PetReminderListItemDto[]>,
  dismissReminders: (ids) => ipcRenderer.invoke('pet:dismissReminders', ids) as Promise<void>,
  snoozeReminders: (ids, minutes) =>
    ipcRenderer.invoke('pet:snoozeReminders', ids, minutes) as Promise<void>,
  setWindowCompact: () => ipcRenderer.send('pet:setWindowCompact'),
  setWindowReminderList: () => ipcRenderer.send('pet:setWindowReminderList'),
  setWindowDueAlert: () => ipcRenderer.send('pet:setWindowDueAlert'),
  setWindowReminderAndDue: () => ipcRenderer.send('pet:setWindowReminderAndDue'),
  setOverlayInteractive: (active) => ipcRenderer.send('pet:setOverlayInteractive', active),
  onOpenReminders: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('pet:openReminders', handler)
    return () => ipcRenderer.removeListener('pet:openReminders', handler)
  },
  onReminderDue: (callback) => {
    const handler = (_: unknown, payload: ReminderDuePayload) => callback(payload)
    ipcRenderer.on('pet:reminderDue', handler)
    return () => ipcRenderer.removeListener('pet:reminderDue', handler)
  },
}

contextBridge.exposeInMainWorld('petAPI', api)
