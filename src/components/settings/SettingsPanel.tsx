import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
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

const SECTION_DEFS = [
  { id: 'appearance', icon: Palette },
  { id: 'terminal', icon: Terminal },
  { id: 'connections', icon: Plug },
  { id: 'vault', icon: Database },
  { id: 'shortcuts', icon: Keyboard },
  { id: 'system', icon: Settings2 },
  { id: 'advanced', icon: SlidersHorizontal },
] as const satisfies ReadonlyArray<{ id: string; icon: LucideIcon }>

type SectionId = (typeof SECTION_DEFS)[number]['id']

export function SettingsPanel() {
  const { t } = useTranslation()
  const [section, setSection] = useState<SectionId>('appearance')
  const ui = useUiClasses()

  const sections = useMemo(
    () =>
      SECTION_DEFS.map((s) => ({
        ...s,
        label: t(`settings.sections.${s.id}`),
      })),
    [t],
  )

  return (
    <div className="flex h-full gap-4 overflow-hidden p-4">
      <nav className="flex w-44 shrink-0 flex-col gap-1 no-drag">
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                section === s.id
                  ? ui.segmentActive
                  : cn(ui.segmentInactive, 'font-normal hover:bg-muted'),
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
