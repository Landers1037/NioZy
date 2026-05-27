import { useState } from 'react'
import { Eraser, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getElectronAPI, isElectron } from '@/lib/electron-client'

export function WebviewBrowsingDataActions() {
  const { t } = useTranslation()
  const [clearing, setClearing] = useState(false)
  const [open, setOpen] = useState(false)

  const handleClear = async (): Promise<void> => {
    if (!isElectron()) {
      toast.message(t('settings.preview.webviewClearBrowserOnly'))
      setOpen(false)
      return
    }

    setClearing(true)
    try {
      const result = await getElectronAPI().preview.clearWebviewBrowsingData()
      if (result.ok) {
        toast.success(t('settings.preview.webviewClearSuccess'))
      } else {
        toast.error(result.error ?? t('settings.preview.webviewClearFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.preview.webviewClearFailed'))
    } finally {
      setClearing(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-fit" disabled={clearing}>
          {clearing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Eraser className="size-3.5" />
          )}
          {t('settings.preview.webviewClearData')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('settings.preview.webviewClearConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('settings.preview.webviewClearConfirmDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={clearing}
            onClick={(e) => {
              e.preventDefault()
              void handleClear()
            }}
          >
            {clearing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {t('settings.preview.webviewClearConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
