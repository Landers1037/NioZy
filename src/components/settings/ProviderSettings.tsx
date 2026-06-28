import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BadgePlus, Check, KeyRound, Link2, Pencil, SquareTerminal, Trash2 } from 'lucide-react'
import type {
  ProviderProfile,
  ProviderState,
  ProviderTool,
  SaveProviderInput,
} from '../../../electron/shared/api-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SESSION_TOOL_ICONS } from '@/components/icons/session-tool-icons'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
import { SettingField } from './SettingField'

type ProviderDraft = {
  id?: string
  tool: ProviderTool
  name: string
  claudeSettings: string
  codexAuth: string
  codexConfig: string
}

const EMPTY_DRAFT: ProviderDraft = {
  tool: 'claudeCode',
  name: '',
  claudeSettings: '',
  codexAuth: '',
  codexConfig: '',
}

const TOOL_ORDER: ProviderTool[] = ['claudeCode', 'codex']
const EMPTY_CLAUDE_FORM = {
  authField: 'ANTHROPIC_AUTH_TOKEN',
  authToken: '',
  baseUrl: '',
  defaultModel: '',
  sonnetModel: '',
  sonnetModelName: '',
  opusModel: '',
  opusModelName: '',
  haikuModel: '',
  haikuModelName: '',
  fableModel: '',
  fableModelName: '',
}

type ClaudeFormState = typeof EMPTY_CLAUDE_FORM

function safeParseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) return {}
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function parseClaudeForm(text: string): ClaudeFormState {
  const raw = safeParseJsonObject(text)
  if (!raw) return { ...EMPTY_CLAUDE_FORM }
  const pick = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
  const authField =
    typeof raw.ANTHROPIC_API_KEY === 'string' ? 'ANTHROPIC_API_KEY' : 'ANTHROPIC_AUTH_TOKEN'
  return {
    authField,
    authToken:
      authField === 'ANTHROPIC_API_KEY' ? pick('ANTHROPIC_API_KEY') : pick('ANTHROPIC_AUTH_TOKEN'),
    baseUrl: pick('ANTHROPIC_BASE_URL'),
    defaultModel: pick('ANTHROPIC_MODEL'),
    sonnetModel: pick('ANTHROPIC_DEFAULT_SONNET_MODEL'),
    sonnetModelName: pick('ANTHROPIC_DEFAULT_SONNET_MODEL_NAME'),
    opusModel: pick('ANTHROPIC_DEFAULT_OPUS_MODEL'),
    opusModelName: pick('ANTHROPIC_DEFAULT_OPUS_MODEL_NAME'),
    haikuModel: pick('ANTHROPIC_DEFAULT_HAIKU_MODEL'),
    haikuModelName: pick('ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME'),
    fableModel: pick('ANTHROPIC_DEFAULT_FABLE_MODEL'),
    fableModelName: pick('ANTHROPIC_DEFAULT_FABLE_MODEL_NAME'),
  }
}

function buildClaudeSettings(form: ClaudeFormState): string {
  return JSON.stringify(
    {
      [form.authField]: form.authToken,
      ANTHROPIC_BASE_URL: form.baseUrl,
      ANTHROPIC_DEFAULT_FABLE_MODEL: form.fableModel,
      ANTHROPIC_DEFAULT_FABLE_MODEL_NAME: form.fableModelName,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: form.haikuModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME: form.haikuModelName,
      ANTHROPIC_DEFAULT_OPUS_MODEL: form.opusModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: form.opusModelName,
      ANTHROPIC_DEFAULT_SONNET_MODEL: form.sonnetModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL_NAME: form.sonnetModelName,
      ANTHROPIC_MODEL: form.defaultModel,
    },
    null,
    2,
  )
}

function profileToDraft(profile: ProviderProfile): ProviderDraft {
  const fileMap = Object.fromEntries(profile.files.map((file) => [file.key, file.content]))
  return {
    id: profile.id,
    tool: profile.tool,
    name: profile.name,
    claudeSettings: fileMap.claudeSettings ?? '',
    codexAuth: fileMap.codexAuth ?? '',
    codexConfig: fileMap.codexConfig ?? '',
  }
}

function draftToPayload(draft: ProviderDraft): SaveProviderInput {
  return {
    id: draft.id,
    tool: draft.tool,
    name: draft.name.trim(),
    files:
      draft.tool === 'claudeCode'
        ? { claudeSettings: draft.claudeSettings }
        : {
            codexAuth: draft.codexAuth,
            codexConfig: draft.codexConfig,
          },
  }
}

export function ProviderSettings() {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const [state, setState] = useState<ProviderState | null>(null)
  const [activeTool, setActiveTool] = useState<ProviderTool>('claudeCode')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT)
  const [claudeForm, setClaudeForm] = useState<ClaudeFormState>(EMPTY_CLAUDE_FORM)
  const [claudeRawError, setClaudeRawError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void getElectronAPI()
      .providers.getState()
      .then(setState)
      .catch(() => toast.error(t('settings.provider.loadFailed')))
  }, [t])

  const providers = useMemo(
    () => state?.providers.filter((provider) => provider.tool === activeTool) ?? [],
    [activeTool, state],
  )

  const openCreateDialog = () => {
    const nextDraft = { ...EMPTY_DRAFT, tool: activeTool }
    setDraft(nextDraft)
    setClaudeForm(parseClaudeForm(nextDraft.claudeSettings))
    setClaudeRawError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (profile: ProviderProfile) => {
    const nextDraft = profileToDraft(profile)
    setDraft(nextDraft)
    setClaudeForm(parseClaudeForm(nextDraft.claudeSettings))
    setClaudeRawError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const name = draft.name.trim()
    if (!name) {
      toast.error(t('settings.provider.nameRequired'))
      return
    }
    setSubmitting(true)
    try {
      const nextState = await getElectronAPI().providers.save(draftToPayload(draft))
      setState(nextState)
      setDialogOpen(false)
      toast.success(
        draft.id ? t('settings.provider.updated') : t('settings.provider.created'),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.provider.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      const nextState = await getElectronAPI().providers.activate(id)
      setState(nextState)
      toast.success(t('settings.provider.activated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.provider.activateFailed'))
    }
  }

  const handleDelete = async (profile: ProviderProfile) => {
    const ok = window.confirm(
      t('settings.provider.deleteConfirm', {
        name: profile.name,
      }),
    )
    if (!ok) return
    try {
      const nextState = await getElectronAPI().providers.delete(profile.id)
      setState(nextState)
      toast.success(t('settings.provider.deleted'))
    } catch {
      toast.error(t('settings.provider.deleteFailed'))
    }
  }

  const updateClaudeForm = (patch: Partial<ClaudeFormState>) => {
    setClaudeForm((current) => {
      const next = { ...current, ...patch }
      setDraft((draftCurrent) => ({
        ...draftCurrent,
        claudeSettings: buildClaudeSettings(next),
      }))
      return next
    })
    setClaudeRawError(null)
  }

  const handleClaudeRawChange = (value: string) => {
    setDraft((current) => ({ ...current, claudeSettings: value }))
    const parsed = safeParseJsonObject(value)
    if (!parsed) {
      setClaudeRawError(t('settings.provider.claude.rawInvalid'))
      return
    }
    setClaudeForm(parseClaudeForm(value))
    setClaudeRawError(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.provider.title')}</CardTitle>
          <CardDescription>{t('settings.provider.description')}</CardDescription>
          {state ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>{t('settings.provider.configPath', { path: state.providerFilePath })}</div>
              <div>{t('settings.provider.backupPath', { path: state.backupDir })}</div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            className={cn(
              'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
              ui.segmentGroupBg,
            )}
            role="tablist"
            aria-label={t('settings.provider.title')}
          >
            {TOOL_ORDER.map((tool) => (
              (() => {
                const Icon = SESSION_TOOL_ICONS[tool]
                return (
                  <button
                    key={tool}
                    type="button"
                    role="tab"
                    aria-selected={activeTool === tool}
                    onClick={() => setActiveTool(tool)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      activeTool === tool
                        ? cn(ui.segmentActive, 'font-app-bold')
                        : cn(ui.segmentInactive, 'font-app-regular'),
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {t(`settings.provider.tools.${tool}`)}
                  </button>
                )
              })()
            ))}
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'ml-auto h-auto rounded-md px-3 py-1.5 text-sm',
                ui.segmentInactive,
              )}
              onClick={openCreateDialog}
            >
              <BadgePlus className="size-4" />
              {t('settings.provider.add')}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              <div>{t(`settings.provider.targetPaths.${activeTool}.title`)}</div>
              <div className="mt-1 whitespace-pre-wrap font-mono text-xs">
                {t(`settings.provider.targetPaths.${activeTool}.paths`)}
              </div>
            </div>

            {providers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t('settings.provider.empty')}
              </div>
            ) : (
              providers.map((profile) => {
                const active = state?.activeProviderIds[profile.tool] === profile.id
                return (
                  <div
                    key={profile.id}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      active ? 'border-primary bg-primary/5' : 'border-border bg-card',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{profile.name}</h3>
                          {active ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                              {t('settings.provider.active')}
                            </span>
                          ) : null}
                          {profile.importedFromExisting ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {t('settings.provider.imported')}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('settings.provider.updatedAt', { time: profile.updatedAt })}
                        </div>
                        {profile.backupDir ? (
                          <div className="text-xs text-muted-foreground">
                            {t('settings.provider.providerBackupDir', {
                              path: profile.backupDir,
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleActivate(profile.id)}
                          disabled={active}
                          className="gap-2"
                        >
                          <Check className="size-4" />
                          {active
                            ? t('settings.provider.enabled')
                            : t('settings.provider.enable')}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => openEditDialog(profile)}
                          aria-label={t('common.edit')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => handleDelete(profile)}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? t('settings.provider.editTitle') : t('settings.provider.createTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-name">{t('settings.provider.name')}</Label>
              <Input
                id="provider-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, name: e.currentTarget.value }))
                }
                placeholder={t('settings.provider.namePlaceholder')}
                autoFocus
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <SquareTerminal className="size-4" />
                {t(`settings.provider.tools.${draft.tool}`)}
              </div>
              <div className="mt-1 whitespace-pre-wrap font-mono text-xs">
                {t(`settings.provider.targetPaths.${draft.tool}.paths`)}
              </div>
            </div>

            {draft.tool === 'claudeCode' ? (
              <div className="flex flex-col gap-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <SettingField
                    icon={KeyRound}
                    label={t('settings.provider.claude.authField')}
                    description={t('settings.provider.claude.authFieldDesc')}
                  >
                    <Select
                      value={claudeForm.authField}
                      onValueChange={(value) =>
                        updateClaudeForm({
                          authField: value as ClaudeFormState['authField'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANTHROPIC_AUTH_TOKEN">
                          {t('settings.provider.claude.authFields.authToken')}
                        </SelectItem>
                        <SelectItem value="ANTHROPIC_API_KEY">
                          {t('settings.provider.claude.authFields.apiKey')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingField>
                  <SettingField
                    icon={KeyRound}
                    label={t('settings.provider.claude.authToken')}
                    description={t('settings.provider.claude.authTokenDesc')}
                  >
                    <Input
                      value={claudeForm.authToken}
                      onChange={(e) =>
                        updateClaudeForm({ authToken: e.currentTarget.value })
                      }
                      placeholder="sk-ant-..."
                    />
                  </SettingField>
                  <SettingField
                    icon={Link2}
                    label={t('settings.provider.claude.baseUrl')}
                    description={t('settings.provider.claude.baseUrlDesc')}
                  >
                    <Input
                      value={claudeForm.baseUrl}
                      onChange={(e) =>
                        updateClaudeForm({ baseUrl: e.currentTarget.value })
                      }
                      placeholder="https://api.codexzh.com"
                    />
                  </SettingField>
                </div>

                <SettingField
                  icon={SquareTerminal}
                  label={t('settings.provider.claude.defaultModel')}
                  description={t('settings.provider.claude.defaultModelDesc')}
                >
                  <Input
                    value={claudeForm.defaultModel}
                    onChange={(e) =>
                      updateClaudeForm({ defaultModel: e.currentTarget.value })
                    }
                    placeholder="cc-gpt-5.4"
                  />
                </SettingField>

                <div className="flex flex-col gap-3">
                  <div>
                    <Label className="text-sm leading-none">
                      {t('settings.provider.claude.modelMapping')}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('settings.provider.claude.modelMappingDesc')}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[
                      ['sonnet', claudeForm.sonnetModelName, claudeForm.sonnetModel],
                      ['opus', claudeForm.opusModelName, claudeForm.opusModel],
                      ['haiku', claudeForm.haikuModelName, claudeForm.haikuModel],
                      ['fable', claudeForm.fableModelName, claudeForm.fableModel],
                    ].map(([role, displayName, requestModel]) => (
                      <div
                        key={role}
                        className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[140px_1fr_1fr]"
                      >
                        <div className="flex items-center text-sm font-medium text-foreground">
                          {t(`settings.provider.claude.roles.${role}`)}
                        </div>
                        <Input
                          value={displayName}
                          onChange={(e) =>
                            updateClaudeForm({
                              [`${role}ModelName`]: e.currentTarget.value,
                            } as Partial<ClaudeFormState>)
                          }
                          placeholder="cc-gpt-5.4"
                        />
                        <Input
                          value={requestModel}
                          onChange={(e) =>
                            updateClaudeForm({
                              [`${role}Model`]: e.currentTarget.value,
                            } as Partial<ClaudeFormState>)
                          }
                          placeholder="cc-gpt-5.4"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="provider-claude-settings">
                    {t('settings.provider.claude.rawTitle')}
                  </Label>
                  <Textarea
                    id="provider-claude-settings"
                    value={draft.claudeSettings}
                    onChange={(e) => handleClaudeRawChange(e.currentTarget.value)}
                    className="min-h-[260px] font-mono text-xs"
                    spellcheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    {claudeRawError ?? t('settings.provider.claude.rawDesc')}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="provider-codex-auth">auth.json</Label>
                  <Textarea
                    id="provider-codex-auth"
                    value={draft.codexAuth}
                    onChange={(e) =>
                      setDraft((current) => ({
                        ...current,
                        codexAuth: e.currentTarget.value,
                      }))
                    }
                    className="min-h-[180px] font-mono text-xs"
                    spellcheck={false}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="provider-codex-config">config.toml</Label>
                  <Textarea
                    id="provider-codex-config"
                    value={draft.codexConfig}
                    onChange={(e) =>
                      setDraft((current) => ({
                        ...current,
                        codexConfig: e.currentTarget.value,
                      }))
                    }
                    className="min-h-[220px] font-mono text-xs"
                    spellcheck={false}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={submitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
