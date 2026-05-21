import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Palette,
  Terminal,
  Plug,
  Settings2,
  SlidersHorizontal,
  Database,
  Keyboard,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppearanceSettings } from './AppearanceSettings'
import { TerminalSettings } from './TerminalSettings'
import { ConnectionSettings } from './ConnectionSettings'
import { SystemSettings } from './SystemSettings'
import { AdvancedSettings } from './AdvancedSettings'
import { VaultSettings } from './VaultSettings'
import { ShortcutSettings } from './ShortcutSettings'

const SECTIONS = [
  { id: 'appearance', label: '外观设置', icon: Palette },
  { id: 'terminal', label: '终端设置', icon: Terminal },
  { id: 'connections', label: '连接设置', icon: Plug },
  { id: 'vault', label: '存储库', icon: Database },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'system', label: '系统设置', icon: Settings2 },
  { id: 'advanced', label: '高级设置', icon: SlidersHorizontal },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>

type SectionId = (typeof SECTIONS)[number]['id']

export function SettingsPanel() {
  const [section, setSection] = useState<SectionId>('appearance')

  return (
    <div className="flex h-full gap-4 overflow-hidden p-4">
      <nav className="flex w-44 shrink-0 flex-col gap-1 no-drag">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                section === s.id
                  ? 'bg-card font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {s.label}
            </button>
          )
        })}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto no-drag">
        {section === 'appearance' && <AppearanceSettings />}
        {section === 'terminal' && <TerminalSettings />}
        {section === 'connections' && <ConnectionSettings />}
        {section === 'vault' && <VaultSettings />}
        {section === 'shortcuts' && <ShortcutSettings />}
        {section === 'system' && <SystemSettings />}
        {section === 'advanced' && <AdvancedSettings />}
      </div>
    </div>
  )
}
