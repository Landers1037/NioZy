import { useCallback, useEffect, useState } from 'react'
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
      toast.success(draft.id ? '已更新变量' : '已添加变量')
      resetDraft()
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
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
    toast.success('已删除')
    if (draft.id === id) resetDraft()
    await reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            存储库
          </CardTitle>
          <CardDescription>
            全局明文与密文变量，可在代理、环境变量等处通过{' '}
            <code className="rounded bg-muted px-1">${'${变量名}'}</code> 引用
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SettingField
            icon={KeyRound}
            label="加密密钥"
            description={`默认使用 NioZy 的 MD5（${getDefaultKeyHint()}）。可在 %USERPROFILE%/.config/NioZy/niozy.key 放置 32 字符自定义密钥。`}
          />

          <div className="rounded-lg border border-border p-4 flex flex-col gap-4">
            <p className="text-sm font-medium">{draft.id ? '编辑变量' : '添加变量'}</p>
            <SettingField icon={Variable} label="变量名">
              <Input
                className="max-w-xs"
                placeholder="MY_SECRET"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              />
            </SettingField>
            <SettingField icon={Lock} label="类型">
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
                  <SelectItem value="plain">明文</SelectItem>
                  <SelectItem value="secret">密文</SelectItem>
                </SelectContent>
              </Select>
            </SettingField>
            <SettingField
              icon={draft.type === 'secret' ? Lock : Variable}
              label="值"
              description={
                draft.type === 'secret' && draft.id
                  ? '留空则保持原密文不变'
                  : undefined
              }
            >
              <Input
                className="max-w-md"
                type={draft.type === 'secret' ? 'password' : 'text'}
                placeholder={draft.type === 'secret' ? '••••••••' : '变量值'}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            </SettingField>
            <div className="flex gap-2">
              <Button onClick={() => void save()}>保存</Button>
              {draft.id && (
                <Button variant="ghost" onClick={resetDraft}>
                  取消编辑
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">已保存变量</p>
            {variables.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无变量</p>
            )}
            {variables.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium font-mono text-sm">{v.key}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.type === 'plain' ? `明文 · ${v.value ?? ''}` : '密文 · ********'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => edit(v)}>
                    编辑
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
