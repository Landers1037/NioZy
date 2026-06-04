import { create } from 'zustand'
import type { ReminderDuePayload, ReminderItem } from '../../electron/shared/reminder-data'
import { getElectronAPI } from '@/lib/electron-client'

interface ReminderState {
  items: ReminderItem[]
  loading: boolean
  duePayload: ReminderDuePayload | null
  dueDialogOpen: boolean
  load: () => Promise<void>
  saveItem: (item: ReminderItem) => Promise<ReminderItem>
  deleteItem: (id: string) => Promise<void>
  snoozeItems: (ids: string[], minutes: number) => Promise<void>
  dismissItems: (ids: string[]) => Promise<void>
  clearCompleted: () => Promise<number>
  showDueDialog: (payload: ReminderDuePayload) => void
  closeDueDialog: () => void
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  items: [],
  loading: false,
  duePayload: null,
  dueDialogOpen: false,

  load: async () => {
    set({ loading: true })
    try {
      const items = await getElectronAPI().reminder.list()
      set({ items })
    } finally {
      set({ loading: false })
    }
  },

  saveItem: async (item) => {
    const saved = await getElectronAPI().reminder.save(item)
    await get().load()
    return saved
  },

  deleteItem: async (id) => {
    await getElectronAPI().reminder.delete(id)
    await get().load()
  },

  snoozeItems: async (ids, minutes) => {
    await getElectronAPI().reminder.snooze(ids, minutes)
    set({ dueDialogOpen: false, duePayload: null })
    await get().load()
  },

  dismissItems: async (ids) => {
    await getElectronAPI().reminder.dismiss(ids)
    set({ dueDialogOpen: false, duePayload: null })
    await get().load()
  },

  clearCompleted: async () => {
    const removed = await getElectronAPI().reminder.clearCompleted()
    await get().load()
    return removed
  },

  showDueDialog: (payload) => {
    set({ duePayload: payload, dueDialogOpen: true })
  },

  closeDueDialog: () => {
    set({ dueDialogOpen: false, duePayload: null })
  },
}))
