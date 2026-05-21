import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import type { CustomConnection } from '@/stores/app-store'
import { randomUUID } from '@/lib/id'
import { parseEnvLines, formatEnvLines } from '@/lib/connection-env'
import {
  BUILTIN_SHELL_TYPES,
  BUILTIN_SHELL_EXECUTABLE,
  BUILTIN_SHELL_LABELS,
  type BuiltinShellType,
} from '../../../electron/shared/builtin-shells'
import { SettingField } from './SettingField'
import { TextareaWithVaultPicker } from './TextareaWithVaultPicker'
import {
  Cable,
  FileCode,
  Key,
  List,
  Network,
  Pencil,
  Plug,
  Server,
  Tag,
  Terminal,
  User,
} from 'lucide-react'

function builtinConfigSummary(args: string[], env: Record<string, string>): string {
  const parts: string[] = []
  if (args.length > 0) parts.push(`${args.length} 个参数`)
  const envCount = Object.keys(env).length
  if (envCount > 0) parts.push(`${envCount} 个环境变量`)
  return parts.length > 0 ? parts.join('，') : '默认启动'
}

export function ConnectionSettings() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [editingBuiltin, setEditingBuiltin] = useState<BuiltinShellType | null>(null)
  const [builtinDraft, setBuiltinDraft] = useState({ argsStr: '', envStr: '' })
  const [draft, setDraft] = useState({
    type: 'command' as 'command' | 'ssh',
    name: '',
    command: '',
    argsStr: '',
    envStr: '',
    sshUser: '',
    sshHost: '',
    sshPort: 22,
    sshAuth: 'password' as 'password' | 'publickey',
    sshKeyPath: '',
  })

  if (!settings) return null

  const startEditBuiltin = (shell: BuiltinShellType) => {
    const config = settings.builtinConnections[shell]
    setEditingBuiltin(shell)
    setBuiltinDraft({
      argsStr: config.args.join(' '),
      envStr: formatEnvLines(config.env),
    })
  }

  const saveBuiltin = () => {
    if (!editingBuiltin) return
    patchSettings({
      builtinConnections: {
        ...settings.builtinConnections,
        [editingBuiltin]: {
          args: builtinDraft.argsStr.split(' ').filter(Boolean),
          env: parseEnvLines(builtinDraft.envStr),
        },
      },
    })
    setEditingBuiltin(null)
  }

  const saveConnection = () => {
    if (!draft.name.trim()) return

    let conn: CustomConnection

    if (draft.type === 'ssh') {
      if (!draft.sshHost.trim() || !draft.sshUser.trim()) return
      conn = {
        id: randomUUID(),
        name: draft.name.trim(),
        type: 'ssh',
        command: draft.sshHost.trim(),
        args: [],
        env: {},
        sshAuth: draft.sshAuth,
        sshUser: draft.sshUser.trim(),
        sshHost: draft.sshHost.trim(),
        sshPort: draft.sshPort,
        sshKeyPath: draft.sshKeyPath || undefined,
      }
    } else {
      if (!draft.command.trim()) return
      conn = {
        id: randomUUID(),
        name: draft.name.trim(),
        type: 'command',
        command: draft.command.trim(),
        args: draft.argsStr.split(' ').filter(Boolean),
        env: parseEnvLines(draft.envStr),
      }
    }

    patchSettings({ connections: [...settings.connections, conn] })
    setDraft({
      type: 'command',
      name: '',
      command: '',
      argsStr: '',
      envStr: '',
      sshUser: '',
      sshHost: '',
      sshPort: 22,
      sshAuth: 'password',
      sshKeyPath: '',
    })
  }

  const removeConnection = (id: string) => {
    patchSettings({
      connections: settings.connections.filter((c) => c.id !== id),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-5" />
            内置连接
          </CardTitle>
          <CardDescription>cmd.exe、powershell.exe、pwsh.exe</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {BUILTIN_SHELL_TYPES.map((shell) => {
            const config = settings.builtinConnections[shell]
            const isEditing = editingBuiltin === shell
            return (
              <div
                key={shell}
                className="rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{BUILTIN_SHELL_LABELS[shell]}</p>
                    <p className="text-xs text-muted-foreground">
                      {BUILTIN_SHELL_EXECUTABLE[shell]} ·{' '}
                      {builtinConfigSummary(config.args, config.env)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      isEditing ? setEditingBuiltin(null) : startEditBuiltin(shell)
                    }
                  >
                    <Pencil className="size-3.5" />
                    {isEditing ? '收起' : '编辑'}
                  </Button>
                </div>
                {isEditing && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
                    <SettingField icon={List} label="启动参数（空格分隔）">
                      <Input
                        value={builtinDraft.argsStr}
                        onChange={(e) =>
                          setBuiltinDraft({ ...builtinDraft, argsStr: e.target.value })
                        }
                        placeholder="-NoLogo -ExecutionPolicy Bypass"
                      />
                    </SettingField>
                    <SettingField
                      icon={FileCode}
                      label="环境变量（KEY=VALUE，每行一个）"
                    >
                      <TextareaWithVaultPicker
                        value={builtinDraft.envStr}
                        onChange={(envStr) => setBuiltinDraft({ ...builtinDraft, envStr })}
                        placeholder="NODE_ENV=development"
                      />
                    </SettingField>
                    <div className="flex gap-2">
                      <Button onClick={saveBuiltin}>保存</Button>
                      <Button variant="ghost" onClick={() => setEditingBuiltin(null)}>
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="size-5" />
            添加自定义连接
          </CardTitle>
          <CardDescription>自定义命令或 SSH 连接</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SettingField icon={Cable} label="类型">
            <Select
              value={draft.type}
              onValueChange={(v) => setDraft({ ...draft, type: v as 'command' | 'ssh' })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="command">自定义命令</SelectItem>
                <SelectItem value="ssh">SSH</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField icon={Tag} label="名称">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </SettingField>

          {draft.type === 'ssh' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <SettingField icon={User} label="用户名">
                  <Input
                    value={draft.sshUser}
                    onChange={(e) => setDraft({ ...draft, sshUser: e.target.value })}
                  />
                </SettingField>
                <SettingField icon={Server} label="主机">
                  <Input
                    value={draft.sshHost}
                    onChange={(e) => setDraft({ ...draft, sshHost: e.target.value })}
                  />
                </SettingField>
              </div>
              <SettingField icon={Network} label="端口">
                <Input
                  type="number"
                  className="max-w-[120px]"
                  value={draft.sshPort}
                  onChange={(e) => setDraft({ ...draft, sshPort: Number(e.target.value) })}
                />
              </SettingField>
              <SettingField icon={Key} label="认证方式">
                <Select
                  value={draft.sshAuth}
                  onValueChange={(v) =>
                    setDraft({ ...draft, sshAuth: v as 'password' | 'publickey' })
                  }
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password">密码登录</SelectItem>
                    <SelectItem value="publickey">公钥登录</SelectItem>
                  </SelectContent>
                </Select>
              </SettingField>
              {draft.sshAuth === 'publickey' && (
                <SettingField icon={FileCode} label="私钥路径">
                  <Input
                    value={draft.sshKeyPath}
                    onChange={(e) => setDraft({ ...draft, sshKeyPath: e.target.value })}
                    placeholder="C:\Users\you\.ssh\id_rsa"
                  />
                </SettingField>
              )}
            </>
          ) : (
            <>
              <SettingField icon={Terminal} label="命令">
                <Input
                  value={draft.command}
                  onChange={(e) => setDraft({ ...draft, command: e.target.value })}
                  placeholder="例如 C:\tools\mycli.exe"
                />
              </SettingField>
              <SettingField icon={List} label="参数（空格分隔）">
                <Input
                  value={draft.argsStr}
                  onChange={(e) => setDraft({ ...draft, argsStr: e.target.value })}
                />
              </SettingField>
              <SettingField
                icon={FileCode}
                label="环境变量（KEY=VALUE，每行一个）"
              >
                <TextareaWithVaultPicker
                  value={draft.envStr}
                  onChange={(envStr) => setDraft({ ...draft, envStr })}
                  placeholder="NODE_ENV=development"
                />
              </SettingField>
            </>
          )}

          <Button onClick={saveConnection}>保存连接</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已保存连接</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {settings.connections.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无自定义连接</p>
          )}
          {settings.connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.type === 'ssh' ? `ssh ${c.sshUser}@${c.sshHost}` : c.command}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeConnection(c.id)}>
                删除
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
