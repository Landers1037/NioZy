import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Activity, Cpu, Droplets } from 'lucide-react'

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
        <SettingField
          icon={Cpu}
          label="硬件加速"
          description="默认开启，需重启应用后完全生效"
          row
        >
          <Switch
            checked={settings.advanced.hardwareAcceleration}
            onCheckedChange={(v) =>
              patchSettings({ advanced: { ...settings.advanced, hardwareAcceleration: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={Activity}
          label="状态栏实时系统信息"
          description="关闭后停止轮询 CPU/内存，可减轻界面刷新开销"
          row
        >
          <Switch
            checked={settings.advanced.statusBarLiveStats !== false}
            onCheckedChange={(v) =>
              patchSettings({ advanced: { ...settings.advanced, statusBarLiveStats: v } })
            }
          />
        </SettingField>

        <SettingField icon={Droplets} label={`窗口透明度: ${settings.advanced.transparency}%`}>
          <Slider
            className="max-w-md"
            min={70}
            max={100}
            step={1}
            value={[settings.advanced.transparency]}
            onValueChange={([v]) =>
              patchSettings({ advanced: { ...settings.advanced, transparency: v } })
            }
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}
