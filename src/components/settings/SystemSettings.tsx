import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import { SettingField } from './SettingField'
import { InputWithVaultPicker } from './InputWithVaultPicker'
import { Download, ExternalLink, Info, Minimize2, Power, Globe } from 'lucide-react'
import { GITHUB_RELEASES_URL } from '@/constants/urls'
import { getElectronAPI } from '@/lib/electron-client'
import logoUrl from '@/logo.png'

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
        <SettingField icon={Globe} label="全局代理">
          <InputWithVaultPicker
            placeholder="http://127.0.0.1:7890"
            value={settings.system.proxy}
            onChange={(proxy) =>
              patchSettings({ system: { ...settings.system, proxy } })
            }
          />
        </SettingField>

        <SettingField
          icon={Power}
          label="随系统启动"
          description="登录 Windows 时自动启动 NioZy"
          row
        >
          <Switch
            checked={settings.system.launchOnStartup}
            onCheckedChange={(v) =>
              patchSettings({ system: { ...settings.system, launchOnStartup: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={Minimize2}
          label="关闭时最小化到托盘"
          description="点击关闭按钮时隐藏到系统托盘"
          row
        >
          <Switch
            checked={settings.system.minimizeToTrayOnClose}
            onCheckedChange={(v) =>
              patchSettings({ system: { ...settings.system, minimizeToTrayOnClose: v } })
            }
          />
        </SettingField>

        <SettingField icon={Download} label="更新">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toast.info('检查更新功能即将推出')}>
              检查更新
            </Button>
            <Button
              variant="outline"
              onClick={() => getElectronAPI().shell.openExternal(GITHUB_RELEASES_URL)}
            >
              <ExternalLink className="size-4" />
              手动更新
            </Button>
          </div>
        </SettingField>

        <div className="rounded-lg border border-border bg-muted/50 p-6">
          <div className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="NioZy"
              className="mb-4 size-20 rounded-xl object-contain"
            />
            <p className="flex items-center gap-2 font-medium">
              <Info className="size-4 text-muted-foreground" />
              关于 NioZy
            </p>
            <p className="mt-1 text-sm text-muted-foreground">版本 0.1.0 (MVP)</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              多终端管理器 — 基于 Electron、React、xterm.js 与 Windows ConPTY。
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
