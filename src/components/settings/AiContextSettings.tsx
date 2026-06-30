import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { getElectronAPI } from '@/lib/electron-client'
import { useAiContextStore } from '@/stores/ai-context-store'
import { AI_RULE_ID_PATTERN } from '../../../electron/shared/ai-context-types'
import type { AiRuleSummary, AiSkillSummary } from '../../../electron/shared/ai-context-types'
import { BookOpen, FileText, FolderOpen, Pencil, Plus, RefreshCw, Trash2, Wand2 } from 'lucide-react'

type RuleDialogMode = 'create' | 'edit'

export function AiContextSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [rules, setRules] = useState<AiRuleSummary[]>([])
  const [skills, setSkills] = useState<AiSkillSummary[]>([])
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [ruleDialogMode, setRuleDialogMode] = useState<RuleDialogMode>('create')
  const [ruleDraftId, setRuleDraftId] = useState('')
  const [ruleDraftContent, setRuleDraftContent] = useState('')
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [savingRule, setSavingRule] = useState(false)

  const aiRuleStates = settings?.ai.aiRuleStates ?? {}

  const reloadRules = useCallback(async () => {
    const list = await getElectronAPI().aiContext.listRules()
    setRules(list)
  }, [])

  const reloadSkills = useCallback(async () => {
    const list = await getElectronAPI().aiContext.listSkills()
    setSkills(list)
    useAiContextStore.getState().bumpRevision()
  }, [])

  useEffect(() => {
    void reloadRules()
    void reloadSkills()
  }, [reloadRules, reloadSkills])

  const patchRuleStates = useCallback(
    (nextStates: Record<string, boolean>) => {
      if (!settings) return
      void patchSettings({
        ai: {
          ...settings.ai,
          aiRuleStates: nextStates,
        },
      }).catch(() => toast.error(t('settings.vault.saveFailed')))
    },
    [patchSettings, settings, t],
  )

  const openCreateRule = () => {
    setRuleDialogMode('create')
    setRuleDraftId('')
    setRuleDraftContent('')
    setRuleDialogOpen(true)
  }

  const openEditRule = async (id: string) => {
    try {
      const content = await getElectronAPI().aiContext.readRule(id)
      if (content == null) {
        toast.error(t('settings.ai.context.ruleNotFound'))
        await reloadRules()
        return
      }
      setRuleDialogMode('edit')
      setRuleDraftId(id)
      setRuleDraftContent(content)
      setRuleDialogOpen(true)
    } catch {
      toast.error(t('settings.ai.context.ruleLoadFailed'))
    }
  }

  const ruleIdError = useMemo(() => {
    if (ruleDialogMode === 'edit') return null
    const trimmed = ruleDraftId.trim()
    if (!trimmed) return t('settings.ai.context.ruleIdRequired')
    if (!AI_RULE_ID_PATTERN.test(trimmed)) return t('settings.ai.context.ruleIdInvalid')
    if (rules.some((rule) => rule.id === trimmed)) return t('settings.ai.context.ruleIdDuplicate')
    return null
  }, [ruleDialogMode, ruleDraftId, rules, t])

  const saveRule = async () => {
    const id = ruleDraftId.trim()
    if (ruleDialogMode === 'create' && ruleIdError) {
      toast.error(ruleIdError)
      return
    }
    if (!ruleDraftContent.trim()) {
      toast.error(t('settings.ai.context.ruleContentRequired'))
      return
    }
    setSavingRule(true)
    try {
      await getElectronAPI().aiContext.saveRule({ id, content: ruleDraftContent })
      if (ruleDialogMode === 'create') {
        patchRuleStates({ ...aiRuleStates, [id]: true })
      }
      toast.success(
        ruleDialogMode === 'create'
          ? t('settings.ai.context.ruleCreated')
          : t('settings.ai.context.ruleUpdated'),
      )
      setRuleDialogOpen(false)
      useAiContextStore.getState().bumpRevision()
      await reloadRules()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settings.ai.context.ruleSaveFailed'))
    } finally {
      setSavingRule(false)
    }
  }

  const toggleRule = (id: string, enabled: boolean) => {
    patchRuleStates({ ...aiRuleStates, [id]: enabled })
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)))
  }

  const confirmDeleteRule = async () => {
    if (!deleteRuleId) return
    try {
      await getElectronAPI().aiContext.deleteRule(deleteRuleId)
      const nextStates = { ...aiRuleStates }
      delete nextStates[deleteRuleId]
      patchRuleStates(nextStates)
      toast.success(t('settings.ai.context.ruleDeleted'))
      setDeleteRuleId(null)
      useAiContextStore.getState().bumpRevision()
      await reloadRules()
    } catch {
      toast.error(t('settings.ai.context.ruleDeleteFailed'))
    }
  }

  const openSkillsDir = async () => {
    try {
      await getElectronAPI().aiContext.openSkillsDirectory()
    } catch {
      toast.error(t('settings.ai.context.openSkillsDirFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-medium">{t('settings.ai.context.title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('settings.ai.context.description')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-muted-foreground" />
            {t('settings.ai.context.rulesTitle')}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={openCreateRule}>
            <Plus className="size-4" />
            {t('settings.ai.context.addRule')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.ai.context.rulesDesc')}</p>

        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
            {t('settings.ai.context.noRules')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{rule.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.enabled
                      ? t('settings.ai.context.ruleEnabled')
                      : t('settings.ai.context.ruleDisabled')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void openEditRule(rule.id)}
                  >
                    <Pencil className="size-4" />
                    {t('settings.ai.context.edit')}
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t('settings.ai.context.enable')}
                    </span>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) => toggleRule(rule.id, enabled)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteRuleId(rule.id)}
                  >
                    <Trash2 className="size-4" />
                    {t('settings.ai.context.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wand2 className="size-4 text-muted-foreground" />
            {t('settings.ai.context.skillsTitle')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void openSkillsDir()}>
              <FolderOpen className="size-4" />
              {t('settings.ai.context.importSkill')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void reloadSkills()}>
              <RefreshCw className="size-4" />
              {t('settings.ai.context.refreshSkills')}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.ai.context.skillsDesc')}</p>

        {skills.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
            {t('settings.ai.context.noSkills')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {skills.map((skill) => (
              <li
                key={skill.id}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2"
              >
                <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{skill.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{skill.id}</p>
                  {skill.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {ruleDialogMode === 'create'
                ? t('settings.ai.context.createRuleTitle')
                : t('settings.ai.context.editRuleTitle')}
            </DialogTitle>
            <DialogDescription>
              {ruleDialogMode === 'create'
                ? t('settings.ai.context.createRuleDesc')
                : t('settings.ai.context.editRuleDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {ruleDialogMode === 'create' ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="ai-rule-id">
                  {t('settings.ai.context.ruleIdLabel')}
                </label>
                <Input
                  id="ai-rule-id"
                  className="font-mono text-sm"
                  value={ruleDraftId}
                  placeholder={t('settings.ai.context.ruleIdPlaceholder')}
                  onChange={(e) => setRuleDraftId(e.currentTarget.value)}
                />
                {ruleIdError ? (
                  <p className="text-xs text-destructive">{ruleIdError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('settings.ai.context.ruleIdHint')}
                  </p>
                )}
              </div>
            ) : (
              <p className="font-mono text-sm text-muted-foreground">{ruleDraftId}</p>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="ai-rule-content">
                {t('settings.ai.context.ruleContentLabel')}
              </label>
              <Textarea
                id="ai-rule-content"
                className="min-h-[240px] font-mono text-sm"
                value={ruleDraftContent}
                placeholder={t('settings.ai.context.ruleContentPlaceholder')}
                onChange={(e) => setRuleDraftContent(e.currentTarget.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={savingRule} onClick={() => void saveRule()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteRuleId != null} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.ai.context.deleteRuleTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.ai.context.deleteRuleDesc', { id: deleteRuleId ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteRule()}>
              {t('settings.ai.context.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
