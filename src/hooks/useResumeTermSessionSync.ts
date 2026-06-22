import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/app-store'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { isElectron } from '@/lib/electron-client'
import { persistResumeTermSession, isResumeTermBootComplete } from '@/lib/resume-term-session'
import { resumeTermLog } from '@/lib/resume-term-log'

const SAVE_DEBOUNCE_MS = 500

/**
 * 开启「重启后恢复终端会话」时，将 Tab 结构与连接配置写入 resume-term.json。
 */
export function useResumeTermSessionSync(): void {
  const enabled = useAppStore((s) => s.settings?.shell.restoreTerminalSessionOnRestart === true)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const terminalCwds = useAppStore((s) => s.terminalCwds)
  const timerRef = useRef<number | null>(null)

  const terminalSnapshotKey = tabs
    .filter((t) => t.type === 'terminal')
    .map((t) => {
      const ids = getAllTerminalIds(t)
      const cwds = ids.map((id) => terminalCwds[id] ?? '').join('|')
      return `${t.id}:${t.title}:${t.customTitle ?? ''}:${t.activeSplitIndex ?? 0}:${t.sshDeferredConnect ? 'd' : ''}:${t.deferredSplitPaneCount ?? 0}:${ids.join(',')}:${cwds}`
    })
    .join(';')

  useEffect(() => {
    if (!isElectron() || !enabled) return
    if (!isResumeTermBootComplete()) {
      resumeTermLog.debug('sync skipped: boot not complete', {
        terminalTabCount: tabs.filter((t) => t.type === 'terminal').length,
      })
      return
    }

    resumeTermLog.debug('sync scheduled', {
      debounceMs: SAVE_DEBOUNCE_MS,
      terminalTabCount: tabs.filter((t) => t.type === 'terminal').length,
    })

    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void persistResumeTermSession()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, terminalSnapshotKey, activeTabId, tabs])

  useEffect(() => {
    if (!isElectron() || !enabled || !isResumeTermBootComplete()) return

    const flush = () => {
      resumeTermLog.info('beforeunload flush')
      void persistResumeTermSession()
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [enabled])
}
