import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
import type { GitBranchInfo } from '../../../electron/shared/repo-types'

interface BranchSwitchDialogProps {
  repoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BranchSwitchDialog({
  repoId,
  open,
  onOpenChange,
  onSuccess,
}: BranchSwitchDialogProps) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const searchRef = useRef<HTMLInputElement>(null)
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [selected, setSelected] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
    setLoading(true)
    void getElectronAPI()
      .repo.listBranches(repoId)
      .then((result) => {
        if (Array.isArray(result)) {
          setBranches(result)
          const current = result.find((b) => b.current)
          setSelected(current?.name ?? result[0]?.name ?? '')
        } else {
          toast.error(result.error)
          setBranches([])
        }
      })
      .finally(() => setLoading(false))
  }, [open, repoId])

  useEffect(() => {
    if (!open || loading) return
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open, loading])

  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return branches
    return branches.filter((branch) => branch.name.toLowerCase().includes(q))
  }, [branches, searchQuery])

  const handleCheckout = async () => {
    if (!selected) return
    setSubmitting(true)
    const result = await getElectronAPI().repo.checkout(repoId, selected)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error ?? t('repo.checkoutFailed'))
      return
    }
    toast.success(t('repo.checkoutSuccess', { branch: selected }))
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('repo.switchBranchTitle')}</DialogTitle>
          <DialogDescription>{t('repo.switchBranchDesc')}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('repo.searchBranchPlaceholder')}
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <ScrollArea className="h-60 rounded-lg border border-border">
              {filteredBranches.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {t('repo.noBranchMatch')}
                </p>
              ) : (
                <ul role="listbox" aria-label={t('repo.selectBranch')} className="py-1">
                  {filteredBranches.map((branch) => (
                    <li key={branch.name} role="option" aria-selected={branch.name === selected}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                          branch.name === selected && ui.fontPickerSelected,
                        )}
                        onClick={() => setSelected(branch.name)}
                      >
                        <span className="truncate font-mono">{branch.name}</span>
                        {branch.remote ? (
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                            ({t('repo.remoteBranch')})
                          </span>
                        ) : null}
                        {branch.current ? (
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                            ({t('repo.currentBranch')})
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleCheckout()} disabled={!selected || submitting}>
            {t('repo.checkout')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
