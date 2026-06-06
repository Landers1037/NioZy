import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getElectronAPI } from '@/lib/electron-client'
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
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void getElectronAPI()
      .repo.listBranches(repoId)
      .then((result) => {
        if (Array.isArray(result)) {
          setBranches(result.filter((b) => !b.name.startsWith('remotes/')))
          const current = result.find((b) => b.current)
          setSelected(current?.name ?? result[0]?.name ?? '')
        } else {
          toast.error(result.error)
          setBranches([])
        }
      })
      .finally(() => setLoading(false))
  }, [open, repoId])

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
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder={t('repo.selectBranch')} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.current ? ` (${t('repo.currentBranch')})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
