import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { COLOR_SCHEME_OPTIONS } from '@/lib/terminal-themes'
import { ColorSchemePreview } from '@/components/settings/ColorSchemePreview'
import { FontSizeInput } from '@/components/settings/FontSizeInput'
import { SettingField } from './SettingField'
import type { TerminalColorScheme } from '../../../electron/shared/api-types'
import { Cpu, Palette, Type } from 'lucide-react'

export function TerminalSettings() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const scheme = settings.terminal.colorScheme

  return (
    <Card>
      <CardHeader>
        <CardTitle>终端设置</CardTitle>
        <CardDescription>配色、字体与渲染方式</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField icon={Palette} label="配色方案">
          <Select
            value={scheme}
            onValueChange={(v) =>
              patchSettings({
                terminal: {
                  ...settings.terminal,
                  colorScheme: v as TerminalColorScheme,
                },
              })
            }
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {COLOR_SCHEME_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ColorSchemePreview schemeId={scheme} />
        </SettingField>

        <SettingField icon={Type} label="终端字体">
          <Input
            className="max-w-xs"
            value={settings.terminal.fontFamily}
            onChange={(e) =>
              patchSettings({
                terminal: { ...settings.terminal, fontFamily: e.target.value },
              })
            }
          />
        </SettingField>

        <FontSizeInput
          icon={Type}
          label="终端字号"
          min={10}
          max={24}
          value={settings.terminal.fontSize}
          onChange={(fontSize) =>
            patchSettings({ terminal: { ...settings.terminal, fontSize } })
          }
        />

        <SettingField
          icon={Cpu}
          label="渲染方式"
          description="WebGPU 渲染器在 xterm.js 中仍处于实验阶段，当前版本将回退到 DOM/WebGL。"
        >
          <Select
            value={settings.terminal.renderer}
            onValueChange={(v) =>
              patchSettings({
                terminal: {
                  ...settings.terminal,
                  renderer: v as typeof settings.terminal.renderer,
                },
              })
            }
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dom">Canvas / DOM（稳定）</SelectItem>
              <SelectItem value="webgl">WebGL（推荐）</SelectItem>
              <SelectItem value="webgpu">WebGPU（实验，可能不可用）</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>
      </CardContent>
    </Card>
  )
}
