import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useReminderStore } from '@/stores/reminder-store'
import { getElectronAPI } from '@/lib/electron-client'
import { showReminderDueToast } from '@/lib/reminder-due-toast'
import { playReminderSound } from '@/lib/reminder-sound'

export function useReminderAlerts(): void {
  const showDueDialog = useReminderStore((s) => s.showDueDialog)

  useEffect(() => {
    const api = getElectronAPI()
    const unsub = api.reminder.onDue((payload) => {
      const settings = useAppStore.getState().settings
      if (!settings?.reminder.enabled) return

      if (settings.reminder.soundEnabled) {
        playReminderSound()
      }

      if (settings.reminder.notifyMode === 'dialog') {
        showDueDialog(payload)
        return
      }

      window.setTimeout(() => {
        for (const item of payload.items) {
          showReminderDueToast(item, settings.reminder.toastDurationSec)
        }
      }, 0)
    })
    return unsub
  }, [showDueDialog])
}
