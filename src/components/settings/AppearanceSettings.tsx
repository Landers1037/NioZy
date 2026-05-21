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
import { FontSizeInput } from '@/components/settings/FontSizeInput'
import { SettingField } from './SettingField'
import { Moon, Palette, Type, LayoutPanelLeft } from 'lucide-react'
import { LAYOUT_MODE_OPTIONS } from '@/lib/layout-mode'
import { cn } from '@/lib/utils'
import type { LayoutMode } from '../../../electron/shared/api-types'

const ACCENT_PRESETS = ['#0A84FF', '#0066FF', '#00D2FF', '#6366F1', '#10B981']

export function AppearanceSettings() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>外观设置</CardTitle>
        <CardDescription>主题、布局、强调色与全局字号</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField icon={LayoutPanelLeft} label="布局模式">
          <div className="flex flex-col gap-3">
            <div
              className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border bg-muted/50 p-1"
              role="tablist"
              aria-label="布局模式"
            >
              {LAYOUT_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={settings.layoutMode === opt.value}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    settings.layoutMode === opt.value
                      ? 'bg-background text-foreground shadow-sm dark:bg-primary/18 dark:ring-1 dark:ring-primary/35'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => patchSettings({ layoutMode: opt.value as LayoutMode })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {
                LAYOUT_MODE_OPTIONS.find((o) => o.value === settings.layoutMode)
                  ?.description
              }
            </p>
          </div>
        </SettingField>

        <SettingField icon={Moon} label="主题模式">
          <Select
            value={settings.theme}
            onValueChange={(v) => patchSettings({ theme: v as 'light' | 'dark' })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">明亮</SelectItem>
              <SelectItem value="dark">暗黑</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField icon={Palette} label="强调色">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className="size-8 rounded-lg border-2 border-border transition-transform hover:scale-105"
                style={{
                  background: color,
                  borderColor: settings.accentColor === color ? color : undefined,
                }}
                onClick={() => patchSettings({ accentColor: color })}
              />
            ))}
          </div>
          <Input
            type="color"
            className="h-8 max-w-[120px] cursor-pointer p-1"
            value={settings.accentColor}
            onChange={(e) => patchSettings({ accentColor: e.target.value })}
          />
        </SettingField>

        <FontSizeInput
          icon={Type}
          label="全局字号"
          min={11}
          max={18}
          value={settings.fontSize}
          onChange={(fontSize) => patchSettings({ fontSize })}
        />
      </CardContent>
    </Card>
  )
}
