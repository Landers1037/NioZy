import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { ensureConfigDir, getResumeTermFilePath } from './config-paths'
import { terminalLog } from './app-log/loggers'
import {
  normalizeResumeTermSession,
  type ResumeTermSession,
} from './shared/resume-term-session'

export class ResumeTermStore {
  save(session: ResumeTermSession): void {
    const path = getResumeTermFilePath()
    ensureConfigDir()
    writeFileSync(path, JSON.stringify(session, null, 2), 'utf-8')
    terminalLog.info('[ResumeTerm] saved', {
      path,
      tabCount: session.tabs.length,
      activeTerminalTabIndex: session.activeTerminalTabIndex,
    })
  }

  load(): ResumeTermSession | null {
    const path = getResumeTermFilePath()
    if (!existsSync(path)) {
      terminalLog.info('[ResumeTerm] load: file not found', { path })
      return null
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
      const rawTabCount =
        raw && typeof raw === 'object' && Array.isArray((raw as { tabs?: unknown }).tabs)
          ? (raw as { tabs: unknown[] }).tabs.length
          : 0
      const session = normalizeResumeTermSession(raw)
      if (!session) {
        terminalLog.warn('[ResumeTerm] load: normalize failed', { path, rawTabCount, raw })
        return null
      }
      terminalLog.info('[ResumeTerm] loaded', {
        path,
        tabCount: session.tabs.length,
        activeTerminalTabIndex: session.activeTerminalTabIndex,
      })
      return session
    } catch (error) {
      terminalLog.error('[ResumeTerm] load: parse/read error', { path, error: String(error) })
      return null
    }
  }

  clear(): void {
    const path = getResumeTermFilePath()
    if (existsSync(path)) {
      try {
        unlinkSync(path)
        terminalLog.info('[ResumeTerm] cleared', { path })
      } catch (error) {
        terminalLog.warn('[ResumeTerm] clear failed', { path, error: String(error) })
      }
    } else {
      terminalLog.debug('[ResumeTerm] clear: file already absent', { path })
    }
  }
}

export const resumeTermStore = new ResumeTermStore()
