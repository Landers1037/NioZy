import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useMarkdownEditorStore } from '@/stores/markdown-editor-store'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { isElectron } from '@/lib/electron-client'
import { persistResumeTermSession, isResumeTermBootComplete } from '@/lib/resume-term-session'
import { resumeTermLog } from '@/lib/resume-term-log'

const SAVE_DEBOUNCE_MS = 500

/**
 * 开启「重启后恢复终端会话」时，将终端与 Markdown Tab 写入 resume-term.json。
 * 仅可恢复 Tab 的状态变化会触发同步。
 */
export function useResumeTermSessionSync(): void {
  const enabled = useAppStore((s) => s.settings?.shell.restoreTerminalSessionOnRestart === true)
  const tabs = useAppStore((s) => s.tabs)
  const activeRestorableTabId = useAppStore((s) => {
    if (!s.activeTabId) return null
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab?.type === 'terminal' || tab?.type === 'markdown' ? s.activeTabId : null
  })
  const terminalCwds = useAppStore((s) => s.terminalCwds)
  const markdownSessions = useMarkdownEditorStore((s) => s.sessions)
  const timerRef = useRef<number | null>(null)
  const lastActiveRestorableTabIdRef = useRef<string | null>(null)

  if (activeRestorableTabId) {
    lastActiveRestorableTabIdRef.current = activeRestorableTabId
  }
  const activeRestorableSyncKey =
    activeRestorableTabId ?? lastActiveRestorableTabIdRef.current ?? ''

  const terminalSnapshotKey = tabs
    .filter((t) => t.type === 'terminal')
    .map((t) => {
      const ids = getAllTerminalIds(t)
      const cwds = ids.map((id) => terminalCwds[id] ?? '').join('|')
      return `${t.id}:${t.title}:${t.customTitle ?? ''}:${t.activeSplitIndex ?? 0}:${t.sshDeferredConnect ? 'd' : ''}:${t.deferredSplitPaneCount ?? 0}:${ids.join(',')}:${cwds}`
    })
    .join(';')

  const markdownSnapshotKey = tabs
    .filter((t) => t.type === 'markdown')
    .map((t) => {
      const session = markdownSessions[t.id]
      const dirtyMarker = session?.dirty ? `d:${session.content.length}` : ''
      return `${t.id}:${t.markdownFilePath ?? ''}:${t.title}:${t.customTitle ?? ''}:${session?.mode ?? ''}:${session?.themeId ?? ''}:${dirtyMarker}`
    })
    .join(';')

  useEffect(() => {
    if (!isElectron() || !enabled) return
    if (!isResumeTermBootComplete()) {
      resumeTermLog.debug('sync skipped: boot not complete', {
        terminalTabCount: terminalSnapshotKey ? terminalSnapshotKey.split(';').filter(Boolean).length : 0,
        markdownTabCount: markdownSnapshotKey ? markdownSnapshotKey.split(';').filter(Boolean).length : 0,
      })
      return
    }

    resumeTermLog.debug('sync scheduled', {
      debounceMs: SAVE_DEBOUNCE_MS,
      terminalTabCount: terminalSnapshotKey ? terminalSnapshotKey.split(';').filter(Boolean).length : 0,
      markdownTabCount: markdownSnapshotKey ? markdownSnapshotKey.split(';').filter(Boolean).length : 0,
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
  }, [enabled, terminalSnapshotKey, markdownSnapshotKey, activeRestorableSyncKey])

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
