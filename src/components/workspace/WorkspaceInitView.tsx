import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FolderOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaceSession, useWorkspaceStore } from '@/stores/workspace-store'
import { WorkspaceToolIcon } from '@/components/icons/workspace-tool-icons'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import {
  WORKSPACE_TOOL_COMMANDS,
  WORKSPACE_TOOL_IDS,
  type WorkspaceToolId,
} from '../../../electron/shared/workspace-types'
import { basenameFromPath } from '@/lib/path-utils'

const TOOL_LABEL_KEYS: Record<WorkspaceToolId, string> = {
  claude: 'workspace.tools.claudeCode',
  opencode: 'workspace.tools.openCode',
  pi: 'workspace.tools.piAgent',
  agent: 'workspace.tools.cursorAgent',
}

interface WorkspaceInitViewProps {
  tabId: string
}

export function WorkspaceInitView({ tabId }: WorkspaceInitViewProps) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const session = useWorkspaceSession(tabId)
  const setSelectedTool = useWorkspaceStore((s) => s.setSelectedTool)
  const setCommandLine = useWorkspaceStore((s) => s.setCommandLine)
  const pickDirectory = useWorkspaceStore((s) => s.pickDirectory)
  const startWorkspace = useWorkspaceStore((s) => s.startWorkspace)
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    setStarting(true)
    try {
      const result = await startWorkspace(tabId)
      if (!result.ok) {
        if (result.error === 'NO_WORKING_DIR') {
          toast.error(t('workspace.errors.noWorkingDir'))
        } else {
          toast.error(result.error)
        }
      }
    } finally {
      setStarting(false)
    }
  }

  const dirLabel = session.workingDir
    ? basenameFromPath(session.workingDir) || session.workingDir
    : t('workspace.homeDir')

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className={cn(
          'flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-border p-3 shadow-sm',
          ui.mainPanel,
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                ui.segmentActive,
                'font-app-bold',
              )}
            >
              <FolderOpen className="size-3.5 shrink-0" />
              <span className="max-w-[140px] truncate">{dirLabel}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-md">
            <DropdownMenuItem onClick={() => void pickDirectory(tabId)}>
              <FolderOpen className="size-4" />
              {t('workspace.browseDirectory')}
            </DropdownMenuItem>
            {session.workingDir && (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {session.workingDir}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                ui.segmentActive,
                'font-app-bold',
              )}
            >
              <WorkspaceToolIcon tool={session.selectedTool} className="size-3.5" />
              <span>{t(TOOL_LABEL_KEYS[session.selectedTool])}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {WORKSPACE_TOOL_IDS.map((toolId) => (
              <DropdownMenuItem key={toolId} onClick={() => setSelectedTool(tabId, toolId)}>
                <WorkspaceToolIcon tool={toolId} className="size-4" />
                {t(TOOL_LABEL_KEYS[toolId])}
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {WORKSPACE_TOOL_COMMANDS[toolId]}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Input
          className="min-w-[160px] flex-1 font-mono text-sm"
          value={session.commandLine}
          placeholder={WORKSPACE_TOOL_COMMANDS[session.selectedTool]}
          onChange={(e) => setCommandLine(tabId, e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleStart()
          }}
        />

        <Button onClick={() => void handleStart()} disabled={starting || !session.workingDir}>
          {starting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('workspace.start')}
        </Button>
      </div>
    </div>
  )
}
