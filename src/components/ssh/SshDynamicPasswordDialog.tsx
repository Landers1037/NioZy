import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  cancelSshDynamicPassword,
  getSshDynamicPasswordPromptRequest,
  submitSshDynamicPassword,
  subscribeSshDynamicPasswordPrompt,
} from '@/lib/ssh-dynamic-password-prompt'

export function SshDynamicPasswordDialog() {
  const { t } = useTranslation()
  const request = useSyncExternalStore(
    subscribeSshDynamicPasswordPrompt,
    getSshDynamicPasswordPromptRequest,
    () => null,
  )
  const [value, setValue] = useState('')

  useEffect(() => {
    if (request) setValue('')
  }, [request])

  const handleOpenChange = (open: boolean) => {
    if (!open && request) cancelSshDynamicPassword()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    submitSshDynamicPassword(value)
  }

  return (
    <Dialog open={request !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('ssh.dynamicPasswordTitle')}</DialogTitle>
            <DialogDescription>
              {t('ssh.dynamicPasswordDescription', { name: request?.connectionName ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="ssh-dynamic-password">{t('ssh.dynamicPasswordLabel')}</Label>
            <Input
              id="ssh-dynamic-password"
              type="password"
              autoFocus
              className="mt-2"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('ssh.dynamicPasswordPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cancelSshDynamicPassword()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('ssh.dynamicPasswordConnect')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
