import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import { randomUUID } from '@/lib/id'
import type { FilesystemCustomOpener } from '../../../electron/shared/filesystem-settings'
import {
  FolderCode,
  Image,
  Search,
  TerminalSquare,
  Plus,
  Trash2,
  ExternalLink,
  GitBranch,
} from 'lucide-react'

export function FilesystemSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const fs = settings.filesystem

  const patchFilesystem = (partial: Partial<typeof fs>) =>
    patchSettings({ filesystem: { ...fs, ...partial } })

  const closeRepoTabIfPresent = useAppStore((s) => s.closeRepoTabIfPresent)
  const closeFilesystemTabIfPresent = useAppStore((s) => s.closeFilesystemTabIfPresent)

  const detectEditor = async (kind: 'vscode' | 'cursor') => {
    const configured = kind === 'vscode' ? fs.vsCodePath : fs.cursorPath
    const result = await getElectronAPI().files.detectProgram({
      kind,
      path: configured.trim() || undefined,
    })
    if (result.found && result.path) {
      toast.success(
        kind === 'vscode'
          ? t('settings.filesystem.vsCodeFound', { path: result.path })
          : t('settings.filesystem.cursorFound', { path: result.path }),
      )
      patchFilesystem(
        kind === 'vscode' ? { vsCodePath: result.path } : { cursorPath: result.path },
      )
    } else {
      toast.error(
        kind === 'vscode'
          ? t('settings.filesystem.vsCodeNotFound')
          : t('settings.filesystem.cursorNotFound'),
      )
    }
  }

  const detectGit = async () => {
    if (fs.gitPath.trim()) {
      patchFilesystem({ gitPath: fs.gitPath.trim() })
    }
    const result = await getElectronAPI().repo.detectGit()
    if (result.found && result.path) {
      toast.success(t('settings.filesystem.gitFound', { path: result.path }))
      if (!fs.gitPath.trim()) {
        patchFilesystem({ gitPath: result.path })
      }
    } else {
      toast.error(t('settings.filesystem.gitNotFound'))
    }
  }

  const handleRepoManagementToggle = (enabled: boolean) => {
    patchFilesystem({ repoManagementEnabled: enabled })
    if (!enabled) closeRepoTabIfPresent()
  }

  const handleLocalFilesystemToggle = (enabled: boolean) => {
    patchFilesystem({ localFilesystemEnabled: enabled })
    if (!enabled) closeFilesystemTabIfPresent()
  }

  const detectCustom = async (opener: FilesystemCustomOpener) => {
    const result = await getElectronAPI().files.detectProgram({
      kind: 'custom',
      path: opener.path,
    })
    if (result.found && result.path) {
      toast.success(t('settings.filesystem.customFound', { path: result.path }))
      patchFilesystem({
        customOpeners: fs.customOpeners.map((o) =>
          o.id === opener.id ? { ...o, path: result.path! } : o,
        ),
      })
    } else {
      toast.error(t('settings.filesystem.customNotFound'))
    }
  }

  const addCustomOpener = () => {
    patchFilesystem({
      customOpeners: [
        ...fs.customOpeners,
        { id: randomUUID(), label: '', path: '' },
      ],
    })
  }

  const updateCustomOpener = (id: string, patch: Partial<FilesystemCustomOpener>) => {
    patchFilesystem({
      customOpeners: fs.customOpeners.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    })
  }

  const removeCustomOpener = (id: string) => {
    patchFilesystem({
      customOpeners: fs.customOpeners.filter((o) => o.id !== id),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 select-none">
          <FolderCode className="size-5" />
          {t('settings.filesystem.title')}
        </CardTitle>
        <CardDescription>{t('settings.filesystem.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={FolderCode}
          label={t('settings.filesystem.localFilesystemEnabled')}
          description={t('settings.filesystem.localFilesystemEnabledDesc')}
          row
        >
          <Switch
            checked={fs.localFilesystemEnabled}
            onCheckedChange={(v) => handleLocalFilesystemToggle(v)}
          />
        </SettingField>

        {fs.localFilesystemEnabled && (
          <SettingField
            icon={FolderCode}
            label={t('settings.filesystem.modernFilesystemUiEnabled')}
            description={t('settings.filesystem.modernFilesystemUiEnabledDesc')}
            row
          >
            <Switch
              checked={fs.modernFilesystemUiEnabled}
              onCheckedChange={(v) => patchFilesystem({ modernFilesystemUiEnabled: v })}
            />
          </SettingField>
        )}

        <SettingField
          icon={Image}
          label={t('settings.filesystem.imagePreview')}
          description={t('settings.filesystem.imagePreviewDesc')}
          row
        >
          <Switch
            checked={fs.imagePreviewEnabled}
            onCheckedChange={(v) => patchFilesystem({ imagePreviewEnabled: v })}
          />
        </SettingField>

        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <p className="text-sm font-medium">{t('settings.filesystem.contextMenuTitle')}</p>

          <SettingField
            icon={TerminalSquare}
            label={t('settings.filesystem.openWithVsCode')}
            description={t('settings.filesystem.openWithVsCodeDesc')}
            row
          >
            <Switch
              checked={fs.openWithVsCode}
              onCheckedChange={(v) => patchFilesystem({ openWithVsCode: v })}
            />
          </SettingField>
          {fs.openWithVsCode && (
            <div className="flex flex-col gap-2 pl-0 sm:pl-8">
              <Input
                value={fs.vsCodePath}
                onChange={(e) => patchFilesystem({ vsCodePath: e.target.value })}
                placeholder={t('settings.filesystem.programPathPlaceholder')}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => void detectEditor('vscode')}
              >
                <Search className="size-4" />
                {t('settings.filesystem.detectVsCode')}
              </Button>
            </div>
          )}

          <SettingField
            icon={ExternalLink}
            label={t('settings.filesystem.openWithCursor')}
            description={t('settings.filesystem.openWithCursorDesc')}
            row
          >
            <Switch
              checked={fs.openWithCursor}
              onCheckedChange={(v) => patchFilesystem({ openWithCursor: v })}
            />
          </SettingField>
          {fs.openWithCursor && (
            <div className="flex flex-col gap-2 pl-0 sm:pl-8">
              <Input
                value={fs.cursorPath}
                onChange={(e) => patchFilesystem({ cursorPath: e.target.value })}
                placeholder={t('settings.filesystem.programPathPlaceholder')}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => void detectEditor('cursor')}
              >
                <Search className="size-4" />
                {t('settings.filesystem.detectCursor')}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{t('settings.filesystem.customOpenersTitle')}</p>
            <Button type="button" variant="outline" size="sm" onClick={addCustomOpener}>
              <Plus className="size-4" />
              {t('settings.filesystem.addCustomOpener')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.filesystem.customOpenersDesc')}
          </p>
          {fs.customOpeners.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noItems')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {fs.customOpeners.map((opener) => (
                <li
                  key={opener.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex gap-2">
                    <Input
                      value={opener.label}
                      onChange={(e) =>
                        updateCustomOpener(opener.id, { label: e.target.value })
                      }
                      placeholder={t('settings.filesystem.customLabelPlaceholder')}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('settings.filesystem.removeCustomOpener')}
                      onClick={() => removeCustomOpener(opener.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Input
                    value={opener.path}
                    onChange={(e) => updateCustomOpener(opener.id, { path: e.target.value })}
                    placeholder={t('settings.filesystem.programPathPlaceholder')}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={() => void detectCustom(opener)}
                  >
                    <Search className="size-4" />
                    {t('settings.filesystem.detectCustom')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <p className="text-sm font-medium">{t('settings.filesystem.repoSettingsTitle')}</p>

          <SettingField
            icon={GitBranch}
            label={t('settings.filesystem.repoManagementEnabled')}
            description={t('settings.filesystem.repoManagementEnabledDesc')}
            row
          >
            <Switch
              checked={fs.repoManagementEnabled}
              onCheckedChange={(v) => handleRepoManagementToggle(v)}
            />
          </SettingField>

          <div className="flex flex-col gap-2 pl-0 sm:pl-8">
            <Input
              value={fs.gitPath}
              onChange={(e) => patchFilesystem({ gitPath: e.target.value })}
              placeholder={t('settings.filesystem.gitPathPlaceholder')}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" className="w-fit" onClick={() => void detectGit()}>
              <Search className="size-4" />
              {t('settings.filesystem.detectGit')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
