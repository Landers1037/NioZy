import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'

export function SystemSettings() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统设置</CardTitle>
        <CardDescription>代理、启动项、托盘与关于</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>全局代理</Label>
          <Input
            className="max-w-md"
            placeholder="http://127.0.0.1:7890"
            value={settings.system.proxy}
            onChange={(e) =>
              patchSettings({ system: { ...settings.system, proxy: e.target.value } })
            }
          />
        </div>

        <div className="flex items-center justify-between max-w-md">
          <div>
            <Label>随系统启动</Label>
            <p className="text-xs text-muted-foreground">登录 Windows 时自动启动 NioZy</p>
          </div>
          <Switch
            checked={settings.system.launchOnStartup}
            onCheckedChange={(v) =>
              patchSettings({ system: { ...settings.system, launchOnStartup: v } })
            }
          />
        </div>

        <div className="flex items-center justify-between max-w-md">
          <div>
            <Label>关闭时最小化到托盘</Label>
            <p className="text-xs text-muted-foreground">点击关闭按钮时隐藏到系统托盘</p>
          </div>
          <Switch
            checked={settings.system.minimizeToTrayOnClose}
            onCheckedChange={(v) =>
              patchSettings({ system: { ...settings.system, minimizeToTrayOnClose: v } })
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>更新</Label>
          <Button variant="secondary" onClick={() => toast.info('检查更新功能即将推出')}>
            检查更新
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="font-medium">关于 NioZy</p>
          <p className="mt-1 text-sm text-muted-foreground">版本 0.1.0 (MVP)</p>
          <p className="mt-2 text-sm text-muted-foreground">
            多终端管理器 — 基于 Electron、React、xterm.js 与 Windows ConPTY。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
