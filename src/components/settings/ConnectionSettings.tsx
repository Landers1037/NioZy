import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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

export function ConnectionSettings() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
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
      const env: Record<string, string> = {}
      draft.envStr.split('\n').forEach((line) => {
        const [k, ...rest] = line.split('=')
        if (k?.trim()) env[k.trim()] = rest.join('=').trim()
      })
      conn = {
        id: randomUUID(),
        name: draft.name.trim(),
        type: 'command',
        command: draft.command.trim(),
        args: draft.argsStr.split(' ').filter(Boolean),
        env,
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
          <CardTitle>内置连接</CardTitle>
          <CardDescription>cmd.exe、powershell.exe、pwsh.exe</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          通过侧栏「新建连接」菜单快速打开内置终端。
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>添加自定义连接</CardTitle>
          <CardDescription>自定义命令或 SSH 连接</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>类型</Label>
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
          </div>

          <div className="flex flex-col gap-2">
            <Label>名称</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          {draft.type === 'ssh' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>用户名</Label>
                  <Input
                    value={draft.sshUser}
                    onChange={(e) => setDraft({ ...draft, sshUser: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>主机</Label>
                  <Input
                    value={draft.sshHost}
                    onChange={(e) => setDraft({ ...draft, sshHost: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>端口</Label>
                <Input
                  type="number"
                  className="max-w-[120px]"
                  value={draft.sshPort}
                  onChange={(e) => setDraft({ ...draft, sshPort: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>认证方式</Label>
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
              </div>
              {draft.sshAuth === 'publickey' && (
                <div className="flex flex-col gap-2">
                  <Label>私钥路径</Label>
                  <Input
                    value={draft.sshKeyPath}
                    onChange={(e) => setDraft({ ...draft, sshKeyPath: e.target.value })}
                    placeholder="C:\Users\you\.ssh\id_rsa"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label>命令</Label>
                <Input
                  value={draft.command}
                  onChange={(e) => setDraft({ ...draft, command: e.target.value })}
                  placeholder="例如 C:\tools\mycli.exe"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>参数（空格分隔）</Label>
                <Input
                  value={draft.argsStr}
                  onChange={(e) => setDraft({ ...draft, argsStr: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>环境变量（KEY=VALUE，每行一个）</Label>
                <textarea
                  className="min-h-[80px] rounded-lg border border-border bg-muted p-2 text-sm"
                  value={draft.envStr}
                  onChange={(e) => setDraft({ ...draft, envStr: e.target.value })}
                  placeholder="NODE_ENV=development"
                />
              </div>
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
