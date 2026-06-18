import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FolderOpen, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getElectronAPI } from '@/lib/electron-client'
import { isValidGitCloneUrl, parseRepoNameFromUrl } from '../../../electron/shared/git-url'

interface RepoCloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  const base = dir.replace(/[/\\]+$/, '')
  return `${base}${sep}${name}`
}

/** Git --progress 用 \r 覆写同一行，静态展示时转为换行 */
function normalizeGitCloneOutput(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function RepoCloneDialog({ open, onOpenChange, onSuccess }: RepoCloneDialogProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('master')
  const [parentDir, setParentDir] = useState('')
  const [targetPath, setTargetPath] = useState('')
  const [targetPathEdited, setTargetPathEdited] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [output, setOutput] = useState('')
  const logRef = useRef<HTMLPreElement>(null)

  const resetForm = useCallback(() => {
    setUrl('')
    setBranch('master')
    setParentDir('')
    setTargetPath('')
    setTargetPathEdited(false)
    setCloning(false)
    setOutput('')
  }, [])

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }
    void navigator.clipboard
      .readText()
      .then((text) => {
        const trimmed = text.trim()
        if (isValidGitCloneUrl(trimmed)) {
          setUrl(trimmed)
        }
      })
      .catch(() => {})
  }, [open, resetForm])

  useEffect(() => {
    if (!targetPathEdited && parentDir) {
      const repoName = parseRepoNameFromUrl(url)
      if (repoName) {
        setTargetPath(joinPath(parentDir, repoName))
      }
    }
  }, [url, parentDir, targetPathEdited])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [output])

  const handleBrowse = async () => {
    const dir = await getElectronAPI().repo.pickParentDirectory()
    if (!dir) return
    setParentDir(dir)
    const repoName = parseRepoNameFromUrl(url)
    if (repoName && !targetPathEdited) {
      setTargetPath(joinPath(dir, repoName))
    }
  }

  const handleClone = async () => {
    const trimmedUrl = url.trim()
    if (!isValidGitCloneUrl(trimmedUrl)) {
      toast.error(t('repo.cloneInvalidUrl'))
      return
    }
    if (!targetPath.trim()) {
      toast.error(t('repo.clonePathRequired'))
      return
    }

    setCloning(true)
    setOutput('')

    const unsub = getElectronAPI().repo.onCloneOutput((chunk) => {
      setOutput((prev) => prev + normalizeGitCloneOutput(chunk))
    })

    try {
      const result = await getElectronAPI().repo.clone({
        url: trimmedUrl,
        branch: branch.trim() || 'master',
        targetPath: targetPath.trim(),
      })
      if (!result.ok) {
        const knownErrors = ['GIT_NOT_FOUND', 'INVALID_URL', 'PATH_INVALID', 'PATH_EXISTS', 'NOT_GIT_REPO']
        toast.error(
          result.error && knownErrors.includes(result.error)
            ? t(`repo.errors.${result.error}`)
            : t('repo.cloneFailed'),
        )
        return
      }
      toast.success(t('repo.cloneSuccess'))
      onOpenChange(false)
      onSuccess()
    } finally {
      unsub()
      setCloning(false)
    }
  }

  const canClone = Boolean(url.trim() && targetPath.trim() && !cloning)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (cloning) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('repo.cloneTitle')}</DialogTitle>
          <DialogDescription>{t('repo.cloneDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="clone-url">{t('repo.cloneUrlLabel')}</Label>
            <Input
              id="clone-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('repo.cloneUrlPlaceholder')}
              disabled={cloning}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-branch">{t('repo.cloneBranchLabel')}</Label>
            <Input
              id="clone-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="master"
              disabled={cloning}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-path">{t('repo.clonePathLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="clone-path"
                value={targetPath}
                onChange={(e) => {
                  setTargetPathEdited(true)
                  setTargetPath(e.target.value)
                }}
                placeholder={t('repo.clonePathPlaceholder')}
                disabled={cloning}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('repo.cloneBrowse')}
                onClick={() => void handleBrowse()}
                disabled={cloning}
              >
                <FolderOpen className="size-4" />
              </Button>
            </div>
          </div>

          {cloning || output ? (
            <div className="grid gap-2">
              <Label>{t('repo.cloneOutputLabel')}</Label>
              <ScrollArea className="h-40 rounded-md border bg-muted/30">
                <pre
                  ref={logRef}
                  className="max-h-40 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap break-all text-foreground"
                >
                  {output || (cloning ? t('repo.cloneStarting') : '')}
                </pre>
              </ScrollArea>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cloning}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleClone()} disabled={!canClone}>
            {cloning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('repo.cloning')}
              </>
            ) : (
              t('repo.cloneAction')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
