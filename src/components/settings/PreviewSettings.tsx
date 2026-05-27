import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { useUiClasses } from '@/lib/ui-style'
import { SettingField } from './SettingField'
import { Eye, Image, BarChart3, Link2, FileText, Globe, Database, FileType2 } from 'lucide-react'
import type { DocumentRenderMode } from '../../../electron/shared/preview-settings'
import { cn } from '@/lib/utils'
import { WebviewCustomHeadersEditor } from './WebviewCustomHeadersEditor'
import { WebviewBrowsingDataActions } from './WebviewBrowsingDataActions'

type PreviewSettingsTab = 'general' | 'document'

export function PreviewSettings() {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [tab, setTab] = useState<PreviewSettingsTab>('general')

  if (!settings) return null

  const preview = settings.preview

  const patchPreview = (partial: Partial<typeof preview>) =>
    patchSettings({ preview: { ...preview, ...partial } })

  const tabs: { id: PreviewSettingsTab; label: string }[] = [
    { id: 'general', label: t('settings.preview.tabGeneral') },
    { id: 'document', label: t('settings.preview.tabDocument') },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-5" />
          {t('settings.preview.title')}
        </CardTitle>
        <CardDescription>{t('settings.preview.description')}</CardDescription>
        <div
          className={cn(
            'mt-3 inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg p-1',
            ui.segmentGroupBg,
          )}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === item.id
                  ? cn(ui.segmentActive, 'font-app-bold')
                  : cn(ui.segmentInactive, 'font-app-regular'),
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {tab === 'general' && (
          <>
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
          </>
        )}

        {tab === 'document' && (
          <SettingField
            icon={FileType2}
            label={t('settings.preview.documentRenderMode')}
            description={t('settings.preview.documentRenderModeDesc')}
          >
            <Select
              value={preview.documentRenderMode}
              onValueChange={(v) => patchPreview({ documentRenderMode: v as DocumentRenderMode })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mammoth">{t('settings.preview.documentRenderMammoth')}</SelectItem>
                <SelectItem value="js-preview">
                  {t('settings.preview.documentRenderJsPreview')}
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingField>
        )}
      </CardContent>
    </Card>
  )
}
