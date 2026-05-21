import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/stores/app-store'

export function AdvancedSettings() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>高级设置</CardTitle>
        <CardDescription>硬件加速、窗口透明度与状态栏监控</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between max-w-md">
          <div>
            <Label>硬件加速</Label>
            <p className="text-xs text-muted-foreground">默认开启，需重启应用后完全生效</p>
          </div>
          <Switch
            checked={settings.advanced.hardwareAcceleration}
            onCheckedChange={(v) =>
              patchSettings({ advanced: { ...settings.advanced, hardwareAcceleration: v } })
            }
          />
        </div>

        <div className="flex items-center justify-between max-w-md">
          <div>
            <Label>状态栏实时系统信息</Label>
            <p className="text-xs text-muted-foreground">
              关闭后停止轮询 CPU/内存，可减轻界面刷新开销
            </p>
          </div>
          <Switch
            checked={settings.advanced.statusBarLiveStats !== false}
            onCheckedChange={(v) =>
              patchSettings({ advanced: { ...settings.advanced, statusBarLiveStats: v } })
            }
          />
        </div>

        <div className="flex flex-col gap-2 max-w-md">
          <Label>窗口透明度: {settings.advanced.transparency}%</Label>
          <Slider
            min={70}
            max={100}
            step={1}
            value={[settings.advanced.transparency]}
            onValueChange={([v]) =>
              patchSettings({ advanced: { ...settings.advanced, transparency: v } })
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
