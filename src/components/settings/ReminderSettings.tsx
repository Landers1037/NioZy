import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  BellRing,
  ImageIcon,
  MessageSquare,
  PawPrint,
  Scaling,
  Shuffle,
  Timer,
  ToggleLeft,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react'
import {
  PET_DISPLAY_SCALE_DEFAULT,
  PET_DISPLAY_SCALE_MAX,
  PET_DISPLAY_SCALE_MIN,
  PET_DISPLAY_SCALE_STEP,
  normalizePetDisplayScale,
} from '../../../electron/shared/pet-atlas'
import type { PetAnimationStateDto } from '../../../electron/pet-store'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { PetSpritePreview } from './PetSpritePreview'
import { getElectronAPI } from '@/lib/electron-client'

function PetPlaceholderPreview({ className }: { className?: string }) {
  return (
    <div
      className={`flex size-[34px] items-center justify-center rounded-[14px] border-2 border-dashed border-muted-foreground/45 bg-muted/30 ${className ?? ''}`}
      aria-hidden
    >
      <span className="size-9 rounded-full bg-muted-foreground/30 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.25)]" />
    </div>
  )
}

export function ReminderSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [petIds, setPetIds] = useState<string[]>([])
  const [petPreviewUrl, setPetPreviewUrl] = useState<string | null>(null)
  const [petNameInput, setPetNameInput] = useState('')
  const [importingPet, setImportingPet] = useState(false)
  const [deletingPet, setDeletingPet] = useState(false)
  const [petStates, setPetStates] = useState<PetAnimationStateDto[]>([])
  const savedPetScale = settings?.reminder.desktopPetScale ?? PET_DISPLAY_SCALE_DEFAULT
  const [draftPetScale, setDraftPetScale] = useState(savedPetScale)

  useEffect(() => {
    setDraftPetScale(savedPetScale)
  }, [savedPetScale])

  const refreshPreview = useCallback(async () => {
    const ext = settings?.reminder.customImageExt
    if (!ext) {
      setPreviewUrl(null)
      return
    }
    const res = await getElectronAPI().reminder.getImageUrl()
    setPreviewUrl(res.ok ? res.url : null)
  }, [settings?.reminder.customImageExt])

  const refreshPetList = useCallback(async () => {
    const ids = await getElectronAPI().reminder.listPets()
    setPetIds(ids)
    return ids
  }, [])

  const refreshPetPreview = useCallback(async (petId: string | null) => {
    if (!petId) {
      setPetPreviewUrl(null)
      return
    }
    const res = await getElectronAPI().reminder.getPetPreviewUrl(petId)
    setPetPreviewUrl(res.ok ? res.url : null)
  }, [])

  useEffect(() => {
    void refreshPreview()
  }, [refreshPreview])

  useEffect(() => {
    void refreshPetList()
  }, [refreshPetList])

  useEffect(() => {
    const activeId =
      settings?.reminder.desktopPetId && petIds.includes(settings.reminder.desktopPetId)
        ? settings.reminder.desktopPetId
        : (petIds[0] ?? null)
    void refreshPetPreview(activeId)
  }, [settings?.reminder.desktopPetId, petIds, refreshPetPreview])

  useEffect(() => {
    const activeId =
      settings?.reminder.desktopPetId && petIds.includes(settings.reminder.desktopPetId)
        ? settings.reminder.desktopPetId
        : (petIds[0] ?? null)
    if (!activeId) {
      setPetStates([])
      return
    }
    void getElectronAPI()
      .reminder.listPetAnimationStates(activeId)
      .then(setPetStates)
  }, [settings?.reminder.desktopPetId, petIds])

  if (!settings) return null

  const reminder = settings.reminder
  const enabled = reminder.enabled
  const isToastMode = reminder.notifyMode === 'toast'
  const selectedPetId =
    reminder.desktopPetId && petIds.includes(reminder.desktopPetId)
      ? reminder.desktopPetId
      : (petIds[0] ?? null)

  const patchReminder = (partial: Partial<typeof reminder>) =>
    patchSettings({ reminder: { ...reminder, ...partial } })

  const petStateLabel = (stateId: string) => {
    const key = `settings.reminder.petState.${stateId}`
    const label = t(key)
    return label === key ? stateId : label
  }

  const previewStateRow =
    petStates.find((s) => s.id === reminder.desktopPetAnimationState)?.row ??
    petStates[0]?.row ??
    0

  const handlePickImage = async () => {
    setPicking(true)
    try {
      const res = await getElectronAPI().reminder.pickImage()
      if (!res.ok) {
        if (res.canceled) return
        if (res.error === 'NOT_IMAGE') {
          toast.error(t('settings.reminder.imagePickNotImage'))
          return
        }
        toast.error(t('settings.reminder.imagePickFailed'))
        return
      }
      patchReminder({ customImageExt: res.ext })
      setPreviewUrl(res.url)
    } finally {
      setPicking(false)
    }
  }

  const handleClearImage = async () => {
    setClearing(true)
    try {
      const res = await getElectronAPI().reminder.clearImage()
      if (!res.ok) {
        toast.error(t('settings.reminder.imageClearFailed'))
        return
      }
      patchReminder({ customImageExt: null })
      setPreviewUrl(null)
    } finally {
      setClearing(false)
    }
  }

  const handleImportPet = async () => {
    setImportingPet(true)
    try {
      const res = await getElectronAPI().reminder.importPet(petNameInput)
      if (!res.ok) {
        if (res.canceled) return
        if (res.error === 'NOT_WEBP') {
          toast.error(t('settings.reminder.petImportNotWebp'))
          return
        }
        if (res.error === 'INVALID_NAME') {
          toast.error(t('settings.reminder.petImportInvalidName'))
          return
        }
        if (res.error === 'NAME_EXISTS') {
          toast.error(t('settings.reminder.petImportNameExists'))
          return
        }
        toast.error(t('settings.reminder.petImportFailed'))
        return
      }
      const ids = await refreshPetList()
      patchReminder({ desktopPetId: res.id })
      setPetPreviewUrl(res.url)
      setPetNameInput('')
      if (!ids.includes(res.id)) {
        await refreshPetList()
      }
      toast.success(t('settings.reminder.petImportSuccess', { name: res.id }))
    } finally {
      setImportingPet(false)
    }
  }

  const handleDeletePet = async () => {
    if (!selectedPetId) return
    if (!window.confirm(t('settings.reminder.petDeleteConfirm', { name: selectedPetId }))) return
    setDeletingPet(true)
    try {
      const res = await getElectronAPI().reminder.deletePet(selectedPetId)
      if (!res.ok) {
        toast.error(t('settings.reminder.petDeleteFailed'))
        return
      }
      const ids = await refreshPetList()
      const nextId = ids[0] ?? null
      patchReminder({ desktopPetId: nextId })
      if (!nextId) setPetPreviewUrl(null)
      toast.success(t('settings.reminder.petDeleteSuccess', { name: selectedPetId }))
    } finally {
      setDeletingPet(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" />
          {t('settings.reminder.title')}
        </CardTitle>
        <CardDescription>{t('settings.reminder.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={ToggleLeft}
          label={t('settings.reminder.enabled')}
          description={t('settings.reminder.enabledDesc')}
          row
        >
          <Switch
            checked={reminder.enabled}
            onCheckedChange={(next) => patchReminder({ enabled: next })}
          />
        </SettingField>

        <SettingField
          icon={PawPrint}
          label={t('settings.reminder.desktopPetEnabled')}
          description={t('settings.reminder.desktopPetEnabledDesc')}
          row
        >
          <Switch
            checked={reminder.desktopPetEnabled}
            onCheckedChange={(next) => patchReminder({ desktopPetEnabled: next })}
          />
        </SettingField>

        <SettingField
          icon={Scaling}
          label={t('settings.reminder.petScale')}
          description={t('settings.reminder.petScaleDesc')}
        >
          <div className="flex max-w-md flex-col gap-2">
            <div className="flex items-center gap-3">
              <Slider
                className="flex-1"
                min={PET_DISPLAY_SCALE_MIN}
                max={PET_DISPLAY_SCALE_MAX}
                step={PET_DISPLAY_SCALE_STEP}
                value={[draftPetScale]}
                disabled={!reminder.desktopPetEnabled}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next !== undefined) {
                    setDraftPetScale(normalizePetDisplayScale(next))
                  }
                }}
                onValueCommit={(value) => {
                  const next = value[0]
                  if (next === undefined) return
                  const normalized = normalizePetDisplayScale(next)
                  setDraftPetScale(normalized)
                  if (normalized === reminder.desktopPetScale) return
                  patchReminder({ desktopPetScale: normalized })
                }}
                aria-label={t('settings.reminder.petScale')}
              />
              <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums">
                {Math.round(draftPetScale * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{Math.round(PET_DISPLAY_SCALE_MIN * 100)}%</span>
              <span>{Math.round(PET_DISPLAY_SCALE_MAX * 100)}%</span>
            </div>
          </div>
        </SettingField>

        <SettingField
          icon={Upload}
          label={t('settings.reminder.petImport')}
          description={t('settings.reminder.petImportDesc')}
        >
          <div className="flex flex-col gap-3">
            <div className="flex max-w-md flex-wrap items-end gap-2">
              <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t('settings.reminder.petName')}
                </span>
                <Input
                  value={petNameInput}
                  placeholder={t('settings.reminder.petNamePlaceholder')}
                  onChange={(e) => setPetNameInput(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                className="w-fit"
                disabled={importingPet}
                onClick={() => void handleImportPet()}
              >
                {t('settings.reminder.petImportButton')}
              </Button>
            </div>

            {petIds.length > 0 ? (
              <div className="flex min-w-0 max-w-md flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {t('settings.reminder.petSelect')}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={selectedPetId ?? undefined}
                      onValueChange={(value) => patchReminder({ desktopPetId: value })}
                    >
                      <SelectTrigger className="min-w-[160px] flex-1">
                        <SelectValue placeholder={t('settings.reminder.petSelectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {petIds.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="w-fit text-destructive hover:text-destructive"
                      disabled={!selectedPetId || deletingPet}
                      onClick={() => void handleDeletePet()}
                    >
                      <Trash2 className="size-4" />
                      {t('settings.reminder.petDelete')}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {t('settings.reminder.petAnimationState')}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={reminder.desktopPetAnimationState}
                      disabled={reminder.desktopPetRandomState || petStates.length === 0}
                      onValueChange={(value) => patchReminder({ desktopPetAnimationState: value })}
                    >
                      <SelectTrigger className="min-w-[140px] flex-1">
                        <SelectValue placeholder={t('settings.reminder.petAnimationStatePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {petStates.map((state) => (
                          <SelectItem key={state.id} value={state.id}>
                            {petStateLabel(state.id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                      <Shuffle className="size-4 text-muted-foreground" />
                      <span className="text-sm whitespace-nowrap">{t('settings.reminder.petRandomState')}</span>
                      <Switch
                        checked={reminder.desktopPetRandomState}
                        disabled={petStates.length <= 1}
                        onCheckedChange={(next) => patchReminder({ desktopPetRandomState: next })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.reminder.petRandomStateDesc')}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('settings.reminder.petEmpty')}</p>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {t('settings.reminder.petPreview')}
              </span>
              <div className="flex items-center justify-center rounded-lg border bg-muted/20 p-3">
                {petPreviewUrl ? (
                  <PetSpritePreview spriteUrl={petPreviewUrl} row={previewStateRow} />
                ) : (
                  <PetPlaceholderPreview />
                )}
              </div>
            </div>
          </div>
        </SettingField>

        <SettingField
          icon={BellRing}
          label={t('settings.reminder.systemNotification')}
          description={t('settings.reminder.systemNotificationDesc')}
          row
        >
          <Switch
            checked={reminder.systemNotification}
            disabled={!enabled}
            onCheckedChange={(next) => patchReminder({ systemNotification: next })}
          />
        </SettingField>

        <SettingField
          icon={MessageSquare}
          label={t('settings.reminder.notifyMode')}
          description={t('settings.reminder.notifyModeDesc')}
        >
          <Select
            value={reminder.notifyMode}
            disabled={!enabled}
            onValueChange={(value: 'toast' | 'dialog') => patchReminder({ notifyMode: value })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toast">{t('settings.reminder.notifyModeToast')}</SelectItem>
              <SelectItem value="dialog">{t('settings.reminder.notifyModeDialog')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField
          icon={Volume2}
          label={t('settings.reminder.soundEnabled')}
          description={t('settings.reminder.soundEnabledDesc')}
          row
        >
          <Switch
            checked={reminder.soundEnabled}
            disabled={!enabled}
            onCheckedChange={(next) => patchReminder({ soundEnabled: next })}
          />
        </SettingField>

        <SettingField
          icon={Timer}
          label={t('settings.reminder.toastDurationSec')}
          description={t('settings.reminder.toastDurationSecDesc')}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={300}
              step={1}
              className="max-w-[88px]"
              disabled={!enabled || !isToastMode}
              value={reminder.toastDurationSec}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) {
                  patchReminder({ toastDurationSec: Math.min(300, Math.max(1, n)) })
                }
              }}
            />
            <span className="text-sm text-muted-foreground">s</span>
          </div>
        </SettingField>

        <SettingField
          icon={ImageIcon}
          label={t('settings.reminder.customImage')}
          description={t('settings.reminder.customImageDesc')}
        >
          <div className="flex flex-col gap-3">
            {previewUrl ? (
              <div className="flex max-w-xs items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3">
                <img
                  src={previewUrl}
                  alt=""
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="w-fit"
                disabled={!enabled || picking}
                onClick={() => void handlePickImage()}
              >
                {t('settings.reminder.customImagePick')}
              </Button>
              <Button
                variant="outline"
                className="w-fit"
                disabled={!enabled || !reminder.customImageExt || clearing}
                onClick={() => void handleClearImage()}
              >
                {t('settings.reminder.customImageClear')}
              </Button>
            </div>
          </div>
        </SettingField>
      </CardContent>
    </Card>
  )
}
