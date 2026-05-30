import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, ChartBar, Eraser, ToggleLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
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
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import { toast } from 'sonner'

export function StatisticsSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  if (!settings) return null

  const statistics = settings.statistics

  const patchStatistics = (partial: Partial<typeof statistics>) =>
    patchSettings({ statistics: { ...statistics, ...partial } })

  const handleClear = async () => {
    setClearing(true)
    try {
      await getElectronAPI().statistics.clear()
      toast.success(t('toast.statisticsCleared'))
      setClearOpen(false)
    } catch {
      toast.error(t('toast.statisticsClearFailed'))
    } finally {
      setClearing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5" />
          {t('settings.statistics.title')}
        </CardTitle>
        <CardDescription>{t('settings.statistics.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={ToggleLeft}
          label={t('settings.statistics.enabled')}
          description={t('settings.statistics.enabledDesc')}
          row
        >
          <Switch
            checked={statistics.enabled}
            onCheckedChange={(enabled) => {
              void patchStatistics({
                enabled,
                ...(enabled ? {} : { showStatusBar: false }),
              })
            }}
          />
        </SettingField>

        <SettingField
          icon={ChartBar}
          label={t('settings.statistics.showStatusBar')}
          description={t('settings.statistics.showStatusBarDesc')}
          row
        >
          <Switch
            checked={statistics.showStatusBar}
            disabled={!statistics.enabled}
            onCheckedChange={(showStatusBar) => patchStatistics({ showStatusBar })}
          />
        </SettingField>

        <SettingField
          icon={Eraser}
          label={t('settings.statistics.clear')}
          description={t('settings.statistics.clearDesc')}
        >
          <Button
            variant="secondary"
            className="w-fit"
            disabled={!statistics.enabled || clearing}
            onClick={() => setClearOpen(true)}
          >
            <Eraser className="size-4" />
            {t('settings.statistics.clear')}
          </Button>
        </SettingField>
      </CardContent>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.statistics.clearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.statistics.clearConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={(e) => {
                e.preventDefault()
                void handleClear()
              }}
            >
              {t('settings.statistics.clearConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
