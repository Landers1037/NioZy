import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Eye, Image, BarChart3, Link2, FileText, Globe, Database } from 'lucide-react'
import { WebviewCustomHeadersEditor } from './WebviewCustomHeadersEditor'
import { WebviewBrowsingDataActions } from './WebviewBrowsingDataActions'

export function PreviewSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const preview = settings.preview

  const patchPreview = (partial: Partial<typeof preview>) =>
    patchSettings({ preview: { ...preview, ...partial } })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-5" />
          {t('settings.preview.title')}
        </CardTitle>
        <CardDescription>{t('settings.preview.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Image}
          label={t('settings.preview.imagePreview')}
          description={t('settings.preview.imagePreviewDesc')}
          row
        >
          <Switch
            checked={preview.imagePreview}
            onCheckedChange={(v) => patchPreview({ imagePreview: v })}
          />
        </SettingField>

        <SettingField
          icon={BarChart3}
          label={t('settings.preview.chartPreview')}
          description={t('settings.preview.chartPreviewDesc')}
          row
        >
          <Switch
            checked={preview.chartPreview}
            onCheckedChange={(v) => patchPreview({ chartPreview: v })}
          />
        </SettingField>

        <SettingField
          icon={Link2}
          label={t('settings.preview.linkPreview')}
          description={t('settings.preview.linkPreviewDesc')}
          row
        >
          <Switch
            checked={preview.linkPreview}
            onCheckedChange={(v) => patchPreview({ linkPreview: v })}
          />
        </SettingField>

        <SettingField
          icon={FileText}
          label={t('settings.preview.anyFilePreview')}
          description={t('settings.preview.anyFilePreviewDesc')}
          row
        >
          <Switch
            checked={preview.anyFilePreview}
            onCheckedChange={(v) => patchPreview({ anyFilePreview: v })}
          />
        </SettingField>

        <div className="border-t border-border pt-6">
          <SettingField
            icon={Globe}
            label={t('settings.preview.webviewHeaders')}
            description={t('settings.preview.webviewHeadersDesc')}
          >
            <WebviewCustomHeadersEditor
              headers={preview.webviewCustomHeaders}
              onChange={(webviewCustomHeaders) => patchPreview({ webviewCustomHeaders })}
            />
          </SettingField>
        </div>

        <SettingField
          icon={Database}
          label={t('settings.preview.webviewBrowsingData')}
          description={t('settings.preview.webviewBrowsingDataDesc')}
        >
          <WebviewBrowsingDataActions />
        </SettingField>
      </CardContent>
    </Card>
  )
}
