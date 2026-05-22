import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import { getDefaultKeyHint } from '@/lib/vault-config-hint'
import type { VaultVariablePublic, VaultVariableType } from '../../../electron/shared/api-types'
import { Database, KeyRound, Lock, Trash2, Variable } from 'lucide-react'
import { toast } from 'sonner'

export function VaultSettings() {
  const { t } = useTranslation()
  const [variables, setVariables] = useState<VaultVariablePublic[]>([])
  const [draft, setDraft] = useState({
    id: '' as string | undefined,
    key: '',
    type: 'plain' as VaultVariableType,
    value: '',
  })

  const reload = useCallback(async () => {
    const list = await getElectronAPI().vault.list()
    setVariables(list)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const resetDraft = () => {
    setDraft({ id: undefined, key: '', type: 'plain', value: '' })
  }

  const save = async () => {
    try {
      await getElectronAPI().vault.save({
        id: draft.id,
        key: draft.key,
        type: draft.type,
        value: draft.value || undefined,
      })
      toast.success(
        draft.id ? t('settings.vault.variableUpdated') : t('settings.vault.variableAdded'),
      )
      resetDraft()
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settings.vault.saveFailed'))
    }
  }

  const edit = (v: VaultVariablePublic) => {
    setDraft({
      id: v.id,
      key: v.key,
      type: v.type,
      value: v.type === 'plain' ? (v.value ?? '') : '',
    })
  }

  const remove = async (id: string) => {
    await getElectronAPI().vault.remove(id)
    toast.success(t('settings.vault.variableDeleted'))
    if (draft.id === id) resetDraft()
    await reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            {t('settings.vault.title')}
          </CardTitle>
          <CardDescription>
            {t('settings.vault.description')}{' '}
            <code className="rounded bg-muted px-1">${'${name}'}</code>{' '}
            {t('settings.vault.descriptionVar')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SettingField
            icon={KeyRound}
            label={t('settings.vault.encryptionKey')}
            description={t('settings.vault.encryptionKeyDesc', { hint: getDefaultKeyHint() })}
          />

          <div className="rounded-lg border border-border p-4 flex flex-col gap-4">
            <p className="text-sm font-medium">
              {draft.id ? t('settings.vault.editVariable') : t('settings.vault.addVariable')}
            </p>
            <SettingField icon={Variable} label={t('settings.vault.variableName')}>
              <Input
                className="max-w-xs"
                placeholder="MY_SECRET"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              />
            </SettingField>
            <SettingField icon={Lock} label={t('settings.vault.type')}>
              <Select
                value={draft.type}
                onValueChange={(v) =>
                  setDraft({ ...draft, type: v as VaultVariableType, value: '' })
                }
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">{t('settings.vault.typePlain')}</SelectItem>
                  <SelectItem value="secret">{t('settings.vault.typeSecret')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingField>
            <SettingField
              icon={draft.type === 'secret' ? Lock : Variable}
              label={t('settings.vault.value')}
              description={
                draft.type === 'secret' && draft.id
                  ? t('settings.vault.keepSecretPlaceholder')
                  : undefined
              }
            >
              <Input
                className="max-w-md"
                type={draft.type === 'secret' ? 'password' : 'text'}
                placeholder={
                  draft.type === 'secret' ? '••••••••' : t('settings.vault.valuePlaceholder')
                }
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            </SettingField>
            <div className="flex gap-2">
              <Button onClick={() => void save()}>{t('common.save')}</Button>
              {draft.id && (
                <Button variant="ghost" onClick={resetDraft}>
                  {t('common.cancelEdit')}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('settings.vault.savedVariables')}</p>
            {variables.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('settings.vault.noVariables')}</p>
            )}
            {variables.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium font-mono text-sm">{v.key}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.type === 'plain'
                      ? t('settings.vault.plainValue', { value: v.value ?? '' })
                      : t('settings.vault.secretValue')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => edit(v)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(v.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
