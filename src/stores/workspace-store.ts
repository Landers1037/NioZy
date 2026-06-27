import { create } from 'zustand'
import type {
  WorkspaceDirEntry,
  WorkspaceGitFile,
  WorkspaceToolId,
} from '../../electron/shared/workspace-types'
import type { WorkspaceHistoryEntry } from '../../electron/shared/workspace-history-types'
import { WORKSPACE_TOOL_COMMANDS } from '../../electron/shared/workspace-types'
import { getElectronAPI } from '@/lib/electron-client'
import { useAppStore } from '@/stores/app-store'
import { scheduleTerminalKills } from '@/lib/schedule-terminal-kills'
import { basenameFromPath } from '@/lib/path-utils'
import { getWorkspaceTabTitle } from '@/lib/i18n'
import { requestTerminalFocus } from '@/lib/terminal-focus'

export type WorkspaceRightPanel = 'files' | 'git'

export interface WorkspaceSession {
  workingDir: string
  selectedTool: WorkspaceToolId
  commandLine: string
  isStarted: boolean
  terminalId: string | null
  rightPanel: WorkspaceRightPanel
  rightPanelCollapsed: boolean
  fileTreeCache: Record<string, WorkspaceDirEntry[]>
  gitFiles: WorkspaceGitFile[]
  gitLoading: boolean
  gitError: string | null
  gitSupported: boolean | null
}

interface WorkspaceStoreState {
  sessions: Record<string, WorkspaceSession>
  ensureSession: (tabId: string, workingDir?: string) => void
  removeSession: (tabId: string) => void
  setWorkingDir: (tabId: string, dir: string) => void
  setSelectedTool: (tabId: string, tool: WorkspaceToolId) => void
  setCommandLine: (tabId: string, line: string) => void
  setRightPanel: (tabId: string, panel: WorkspaceRightPanel) => void
  setRightPanelCollapsed: (tabId: string, collapsed: boolean) => void
  initHomeDir: (tabId: string) => Promise<void>
  pickDirectory: (tabId: string) => Promise<void>
  cacheDirEntries: (tabId: string, dirPath: string, entries: WorkspaceDirEntry[]) => void
  getCachedDirEntries: (tabId: string, dirPath: string) => WorkspaceDirEntry[] | undefined
  clearFileTreeCache: (tabId: string) => void
  startWorkspace: (
    tabId: string,
  ) => Promise<{ ok: true; terminalId: string } | { ok: false; error: string }>
  ensureWorkspaceTerminal: (
    tabId: string,
  ) => Promise<{ ok: true; terminalId: string } | { ok: false; error: string }>
  stopWorkspace: (tabId: string) => Promise<void>
  resetWorkspaceSession: (tabId: string) => void
  restoreFromHistory: (
    tabId: string,
    entry: WorkspaceHistoryEntry,
  ) => Promise<{ ok: true; terminalId: string } | { ok: false; error: string }>
  recordWorkspaceHistory: (tabId: string) => Promise<void>
  refreshGitStatus: (tabId: string) => Promise<void>
  detectGitSupport: (tabId: string) => Promise<void>
}

function createDefaultSession(workingDir = ''): WorkspaceSession {
  return {
    workingDir,
    selectedTool: 'claude',
    commandLine: WORKSPACE_TOOL_COMMANDS.claude,
    isStarted: false,
    terminalId: null,
    rightPanel: 'files',
    rightPanelCollapsed: false,
    fileTreeCache: {},
    gitFiles: [],
    gitLoading: false,
    gitError: null,
    gitSupported: null,
  }
}

function formatWorkspaceTabTitle(workingDir: string): string {
  return basenameFromPath(workingDir) || workingDir
}

function parseCommandLine(line: string, fallbackCommand: string): { command: string; args: string[] } {
  const trimmed = line.trim()
  if (!trimmed) return { command: fallbackCommand, args: [] }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { command: fallbackCommand, args: [] }
  return { command: parts[0]!, args: parts.slice(1) }
}

function formatCommandLine(command: string, args: string[]): string {
  if (args.length === 0) return command
  return `${command} ${args.join(' ')}`
}

function patchSession(
  sessions: Record<string, WorkspaceSession>,
  tabId: string,
  patch: Partial<WorkspaceSession>,
): Record<string, WorkspaceSession> {
  const current = sessions[tabId] ?? createDefaultSession()
  return { ...sessions, [tabId]: { ...current, ...patch } }
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  sessions: {},

  ensureSession: (tabId, workingDir = '') => {
    set((s) => {
      if (s.sessions[tabId]) return s
      return { sessions: { ...s.sessions, [tabId]: createDefaultSession(workingDir) } }
    })
  },

  removeSession: (tabId) => {
    set((s) => {
      const sessions = { ...s.sessions }
      delete sessions[tabId]
      return { sessions }
    })
  },

  setWorkingDir: (tabId, dir) => {
    set((s) => ({ sessions: patchSession(s.sessions, tabId, { workingDir: dir }) }))
    const session = get().sessions[tabId]
    if (session?.isStarted) {
      useAppStore.getState().patchWorkspaceTab(tabId, {
        workspaceDir: dir,
        title: formatWorkspaceTabTitle(dir),
      })
    }
  },

  setSelectedTool: (tabId, tool) => {
    const command = WORKSPACE_TOOL_COMMANDS[tool]
    set((s) => ({
      sessions: patchSession(s.sessions, tabId, { selectedTool: tool, commandLine: command }),
    }))
  },

  setCommandLine: (tabId, line) => {
    set((s) => ({ sessions: patchSession(s.sessions, tabId, { commandLine: line }) }))
  },

  setRightPanel: (tabId, panel) => {
    set((s) => ({ sessions: patchSession(s.sessions, tabId, { rightPanel: panel }) }))
  },

  setRightPanelCollapsed: (tabId, collapsed) => {
    set((s) => ({ sessions: patchSession(s.sessions, tabId, { rightPanelCollapsed: collapsed }) }))
  },

  initHomeDir: async (tabId) => {
    const home = await getElectronAPI().workspace.getHomeDir()
    get().ensureSession(tabId, home)
    set((s) => ({ sessions: patchSession(s.sessions, tabId, { workingDir: home }) }))
  },

  pickDirectory: async (tabId) => {
    const picked = await getElectronAPI().workspace.pickDirectory()
    if (picked) get().setWorkingDir(tabId, picked)
  },

  cacheDirEntries: (tabId, dirPath, entries) => {
    set((s) => {
      const session = s.sessions[tabId] ?? createDefaultSession()
      return {
        sessions: patchSession(s.sessions, tabId, {
          fileTreeCache: { ...session.fileTreeCache, [dirPath]: entries },
        }),
      }
    })
  },

  getCachedDirEntries: (tabId, dirPath) => get().sessions[tabId]?.fileTreeCache[dirPath],

  clearFileTreeCache: (tabId) => {
    set((s) => ({ sessions: patchSession(s.sessions, tabId, { fileTreeCache: {} }) }))
  },

  startWorkspace: async (tabId) => {
    get().ensureSession(tabId)
    const session = get().sessions[tabId]!
    if (session.isStarted) {
      return session.terminalId
        ? { ok: true, terminalId: session.terminalId }
        : { ok: true, terminalId: '' }
    }
    if (!session.workingDir.trim()) {
      return { ok: false, error: 'NO_WORKING_DIR' }
    }

    set((s) => ({
      sessions: patchSession(s.sessions, tabId, { isStarted: true }),
    }))

    useAppStore.getState().patchWorkspaceTab(tabId, {
      workspaceDir: session.workingDir,
      title: formatWorkspaceTabTitle(session.workingDir),
    })

    void get().recordWorkspaceHistory(tabId)

    return { ok: true, terminalId: '' }
  },

  ensureWorkspaceTerminal: async (tabId) => {
    get().ensureSession(tabId)
    const session = get().sessions[tabId]!
    if (!session.isStarted) {
      return { ok: false, error: 'NOT_STARTED' }
    }
    if (session.terminalId) {
      return { ok: true, terminalId: session.terminalId }
    }
    if (!session.workingDir.trim()) {
      return { ok: false, error: 'NO_WORKING_DIR' }
    }

    const fallback = WORKSPACE_TOOL_COMMANDS[session.selectedTool]
    const { command, args } = parseCommandLine(session.commandLine, fallback)

    try {
      const result = await getElectronAPI().terminal.create({
        shell: 'custom',
        command,
        args,
        cwd: session.workingDir,
        name: 'Workspace',
      })

      set((s) => ({
        sessions: patchSession(s.sessions, tabId, {
          isStarted: true,
          terminalId: result.id,
        }),
      }))

      useAppStore.getState().patchWorkspaceTab(tabId, {
        workspaceDir: session.workingDir,
        terminalId: result.id,
        title: formatWorkspaceTabTitle(session.workingDir),
      })

      requestTerminalFocus(result.id)

      void get().detectGitSupport(tabId)
      void get().refreshGitStatus(tabId)

      return { ok: true, terminalId: result.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  },

  stopWorkspace: async (tabId) => {
    get().resetWorkspaceSession(tabId)
    useAppStore.getState().patchWorkspaceTab(tabId, {
      workspaceDir: undefined,
      terminalId: undefined,
      title: getWorkspaceTabTitle(),
    })
  },

  resetWorkspaceSession: (tabId) => {
    const terminalId = get().sessions[tabId]?.terminalId
    if (terminalId) {
      scheduleTerminalKills([terminalId])
    }
    set((s) => ({
      sessions: patchSession(s.sessions, tabId, {
        isStarted: false,
        terminalId: null,
        gitFiles: [],
        gitError: null,
        gitSupported: null,
        rightPanel: 'files',
      }),
    }))
  },

  restoreFromHistory: async (tabId, entry) => {
    get().ensureSession(tabId)
    set((s) => ({
      sessions: patchSession(s.sessions, tabId, {
        workingDir: entry.workingDir,
        selectedTool: entry.selectedTool,
        commandLine: formatCommandLine(entry.command, entry.args),
        isStarted: false,
        terminalId: null,
      }),
    }))

    return get().startWorkspace(tabId)
  },

  recordWorkspaceHistory: async (tabId) => {
    const session = get().sessions[tabId]
    if (!session?.isStarted || !session.workingDir.trim()) return

    const fallback = WORKSPACE_TOOL_COMMANDS[session.selectedTool]
    const { command, args } = parseCommandLine(session.commandLine, fallback)

    try {
      await getElectronAPI().workspace.recordHistory({
        workingDir: session.workingDir,
        selectedTool: session.selectedTool,
        command,
        args,
      })
    } catch {
      // History persistence is best-effort.
    }
  },

  refreshGitStatus: async (tabId) => {
    const session = get().sessions[tabId]
    if (!session?.isStarted || !session.workingDir) return
    set((s) => ({
      sessions: patchSession(s.sessions, tabId, { gitLoading: true, gitError: null }),
    }))
    try {
      const result = await getElectronAPI().workspace.gitStatus(session.workingDir)
      if (!result.ok) {
        set((s) => ({
          sessions: patchSession(s.sessions, tabId, {
            gitLoading: false,
            gitError: result.error,
            gitFiles: [],
          }),
        }))
        return
      }
      set((s) => ({
        sessions: patchSession(s.sessions, tabId, {
          gitLoading: false,
          gitFiles: result.files,
          gitError: null,
        }),
      }))
    } catch (err) {
      set((s) => ({
        sessions: patchSession(s.sessions, tabId, {
          gitLoading: false,
          gitError: err instanceof Error ? err.message : String(err),
          gitFiles: [],
        }),
      }))
    }
  },

  detectGitSupport: async (tabId) => {
    const session = get().sessions[tabId]
    if (!session?.workingDir) return
    try {
      const result = await getElectronAPI().workspace.detectGit(session.workingDir)
      if (!result.ok) {
        set((s) => ({ sessions: patchSession(s.sessions, tabId, { gitSupported: false }) }))
        return
      }
      set((s) => ({
        sessions: patchSession(s.sessions, tabId, { gitSupported: result.isRepo }),
      }))
    } catch {
      set((s) => ({ sessions: patchSession(s.sessions, tabId, { gitSupported: false }) }))
    }
  },
}))

export function useWorkspaceSession(tabId: string): WorkspaceSession {
  return useWorkspaceStore((s) => s.sessions[tabId] ?? createDefaultSession())
}
