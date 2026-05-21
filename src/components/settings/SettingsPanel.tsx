import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AppearanceSettings } from './AppearanceSettings'
import { TerminalSettings } from './TerminalSettings'
import { ConnectionSettings } from './ConnectionSettings'
import { SystemSettings } from './SystemSettings'
import { AdvancedSettings } from './AdvancedSettings'

const SECTIONS = [
  { id: 'appearance', label: '外观设置' },
  { id: 'terminal', label: '终端设置' },
  { id: 'connections', label: '连接设置' },
  { id: 'system', label: '系统设置' },
  { id: 'advanced', label: '高级设置' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function SettingsPanel() {
  const [section, setSection] = useState<SectionId>('appearance')

  return (
    <div className="flex h-full gap-4 overflow-hidden p-4">
      <nav className="flex w-44 shrink-0 flex-col gap-1 no-drag">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              'rounded-lg px-3 py-2 text-left text-sm transition-colors',
              section === s.id
                ? 'bg-card font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-card/60',
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto no-drag">
        {section === 'appearance' && <AppearanceSettings />}
        {section === 'terminal' && <TerminalSettings />}
        {section === 'connections' && <ConnectionSettings />}
        {section === 'system' && <SystemSettings />}
        {section === 'advanced' && <AdvancedSettings />}
      </div>
    </div>
  )
}
