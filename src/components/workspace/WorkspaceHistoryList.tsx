import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { WorkspaceToolIcon } from '@/components/icons/workspace-tool-icons'
import { getElectronAPI } from '@/lib/electron-client'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import { basenameFromPath } from '@/lib/path-utils'
import type { WorkspaceHistoryEntry } from '../../../electron/shared/workspace-history-types'

const TOOL_LABEL_KEYS = {
  claude: 'workspace.tools.claudeCode',
  opencode: 'workspace.tools.openCode',
  pi: 'workspace.tools.piAgent',
  agent: 'workspace.tools.cursorAgent',
} as const

interface WorkspaceHistoryListProps {
  tabId: string
}

export function WorkspaceHistoryList({ tabId }: WorkspaceHistoryListProps) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const restoreFromHistory = useWorkspaceStore((s) => s.restoreFromHistory)
  const [entries, setEntries] = useState<WorkspaceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getElectronAPI().workspace.listHistory()
      setEntries(list)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const handleRestore = async (entry: WorkspaceHistoryEntry) => {
    setRestoringId(entry.id)
    try {
      const result = await restoreFromHistory(tabId, entry)
      if (!result.ok) {
        if (result.error === 'NO_WORKING_DIR') {
          toast.error(t('workspace.errors.noWorkingDir'))
        } else {
          toast.error(result.error)
        }
        return
      }
      setEntries(await getElectronAPI().workspace.listHistory())
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">{t('workspace.history.empty')}</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-xs font-app-bold uppercase tracking-wide text-muted-foreground">
        {t('workspace.history.title')}
      </h3>
      <div className="flex max-h-[min(360px,40vh)] flex-col gap-2 overflow-y-auto">
        {entries.map((entry) => {
          const dirLabel = basenameFromPath(entry.workingDir) || entry.workingDir
          const restoring = restoringId === entry.id

          return (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-border px-3 py-2.5',
                ui.mainPanel,
              )}
            >
              <WorkspaceToolIcon tool={entry.selectedTool} className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-app-bold" title={entry.workingDir}>
                    {dirLabel}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t(TOOL_LABEL_KEYS[entry.selectedTool])}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground" title={entry.workingDir}>
                  {entry.workingDir}
                </p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs">
                  <span className="text-foreground">{entry.command}</span>
                  {entry.args.length > 0 && (
                    <span className="truncate text-muted-foreground" title={entry.args.join(' ')}>
                      {entry.args.join(' ')}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={restoring || restoringId !== null}
                onClick={() => void handleRestore(entry)}
              >
                {restoring ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                {t('workspace.history.restore')}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
