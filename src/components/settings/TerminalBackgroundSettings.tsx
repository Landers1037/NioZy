import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/stores/app-store'
import { useTerminalBackgroundPreviewStore } from '@/stores/terminal-background-preview-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import { toast } from 'sonner'
import {
  MAX_TERMINAL_BACKGROUND_OPACITY,
  MIN_TERMINAL_BACKGROUND_OPACITY,
} from '../../../electron/shared/terminal-background-settings'
import { fetchTerminalBackgroundUrl } from '@/lib/terminal-background'

export function TerminalBackgroundSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [clearing, setClearing] = useState(false)

  const ext = settings?.terminal.backgroundImageExt
  const savedOpacity = settings?.terminal.backgroundOpacity ?? 100
  const [draftOpacity, setDraftOpacity] = useState(savedOpacity)
  const setPreviewOpacity = useTerminalBackgroundPreviewStore((s) => s.setPreviewOpacity)
  const bumpImageRevision = useTerminalBackgroundPreviewStore((s) => s.bumpImageRevision)
  const imageRevision = useTerminalBackgroundPreviewStore((s) => s.imageRevision)
  const hasImage = !!ext

  useEffect(() => {
    setDraftOpacity(savedOpacity)
  }, [savedOpacity])

  useEffect(() => () => setPreviewOpacity(null), [setPreviewOpacity])

  const refreshPreview = useCallback(async () => {
    if (!ext) {
      setPreviewUrl(null)
      return
    }
    const url = await fetchTerminalBackgroundUrl(ext)
    setPreviewUrl(url)
  }, [ext, imageRevision])

  useEffect(() => {
    void refreshPreview()
  }, [refreshPreview])

  if (!settings) return null

  const handlePick = async () => {
    setPicking(true)
    try {
      const res = await getElectronAPI().terminal.pickBackground()
      if (!res.ok) {
        if (res.canceled) return
        if (res.error === 'NOT_IMAGE') {
          toast.error(t('settings.terminal.backgroundPickNotImage'))
          return
        }
        toast.error(t('settings.terminal.backgroundPickFailed'))
        return
      }
      patchSettings({
        terminal: {
          ...settings.terminal,
          backgroundImageExt: res.ext,
        },
      })
      bumpImageRevision()
      setPreviewUrl(res.url)
    } finally {
      setPicking(false)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      const res = await getElectronAPI().terminal.clearBackground()
      if (!res.ok) {
        toast.error(t('settings.terminal.backgroundClearFailed'))
        return
      }
      patchSettings({
        terminal: {
          ...settings.terminal,
          backgroundImageExt: undefined,
        },
      })
      bumpImageRevision()
      setPreviewUrl(null)
    } finally {
      setClearing(false)
    }
  }

  return (
    <SettingField
      icon={ImageIcon}
      label={t('settings.terminal.background')}
      description={t('settings.terminal.backgroundDesc')}
    >
      <div className="flex max-w-md flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={picking}
            onClick={() => void handlePick()}
          >
            {t('settings.terminal.backgroundPick')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasImage || clearing}
            onClick={() => void handleClear()}
          >
            {t('settings.terminal.backgroundClear')}
          </Button>
        </div>

        {previewUrl ? (
          <div
            className="h-24 w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted/30"
            role="img"
            aria-label={t('settings.terminal.backgroundPreview')}
          >
            <div
              className="h-full w-full bg-cover bg-center"
              style={{
                backgroundImage: `url(${previewUrl})`,
                opacity: draftOpacity / 100,
              }}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">
            {t('settings.terminal.backgroundOpacity', { value: draftOpacity })}
          </span>
          <Slider
            className="max-w-md"
            min={MIN_TERMINAL_BACKGROUND_OPACITY}
            max={MAX_TERMINAL_BACKGROUND_OPACITY}
            step={1}
            disabled={!hasImage}
            value={[draftOpacity]}
            onValueChange={([v]) => {
              setDraftOpacity(v)
              setPreviewOpacity(v)
            }}
            onValueCommit={([v]) => {
              setPreviewOpacity(null)
              if (v === savedOpacity) return
              void patchSettings({
                terminal: { ...settings.terminal, backgroundOpacity: v },
              })
            }}
          />
        </div>
      </div>
    </SettingField>
  )
}
