import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CommitFileDiffView } from '@/components/repo/CommitFileDiffView'
import { getElectronAPI } from '@/lib/electron-client'
import { useWorkspaceSession } from '@/stores/workspace-store'

interface WorkspaceDiffDialogProps {
  tabId: string
  filePath: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspaceDiffDialog({
  tabId,
  filePath,
  open,
  onOpenChange,
}: WorkspaceDiffDialogProps) {
  const { t } = useTranslation()
  const session = useWorkspaceSession(tabId)
  const [diff, setDiff] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDiff = useCallback(async () => {
    if (!session.workingDir || !filePath) return
    setLoading(true)
    setError(null)
    try {
      const result = await getElectronAPI().workspace.gitDiff(session.workingDir, filePath)
      if (!result.ok) {
        setError(result.error)
        setDiff('')
        return
      }
      setDiff(result.diff || t('repo.diffEmpty'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDiff('')
    } finally {
      setLoading(false)
    }
  }, [filePath, session.workingDir, t])

  useEffect(() => {
    if (open) void loadDiff()
  }, [open, loadDiff])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="truncate font-mono text-sm">{filePath}</DialogTitle>
        </DialogHeader>
        <div className="min-h-[320px] flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('repo.loadingDiff')}
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : (
            <CommitFileDiffView diff={diff} className="h-[min(70vh,560px)]" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
