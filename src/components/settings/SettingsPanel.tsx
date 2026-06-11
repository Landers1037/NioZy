import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
import {
  Palette,
  Terminal,
  Server,
  TerminalSquare,
  Plug,
  Accessibility,
  Settings2,
  SlidersHorizontal,
  ScrollText,
  Database,
  Keyboard,
  FolderCode,
  PenTool,
  FlaskConical,
  Gauge,
  Eye,
  BarChart3,
  MessageSquare,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppearanceSettings } from './AppearanceSettings'
import { TerminalSettings } from './TerminalSettings'
import { SshSettings } from './SshSettings'
import { ShellSettings } from './ShellSettings'
import { PerformanceSettings } from './PerformanceSettings'
import { FilesystemSettings } from './FilesystemSettings'
import { ConnectionSettings } from './ConnectionSettings'
import { StatisticsSettings } from './StatisticsSettings'
import { ReminderSettings } from './ReminderSettings'
import { AssistiveSettings } from './AssistiveSettings'
import { SystemSettings } from './SystemSettings'
import { AdvancedSettings } from './AdvancedSettings'
import { LogSettings } from './LogSettings'
import { VaultSettings } from './VaultSettings'
import { ShortcutSettings } from './ShortcutSettings'
import { ExperimentalSettings } from './ExperimentalSettings'
import { PreviewSettings } from './PreviewSettings'
import { P2pSettings } from './P2pSettings'
import { DrawingSettings } from './DrawingSettings'

const SECTION_DEFS = [
  { id: 'appearance', icon: Palette },
  { id: 'terminal', icon: Terminal },
  { id: 'ssh', icon: Server },
  { id: 'shell', icon: TerminalSquare },
  { id: 'preview', icon: Eye },
  { id: 'performance', icon: Gauge },
  { id: 'filesystem', icon: FolderCode },
  { id: 'drawing', icon: PenTool },
  { id: 'connections', icon: Plug },
  { id: 'vault', icon: Database },
  { id: 'shortcuts', icon: Keyboard },
  { id: 'statistics', icon: BarChart3 },
  { id: 'reminder', icon: Bell },
  { id: 'assistive', icon: Accessibility },
  { id: 'system', icon: Settings2 },
  { id: 'p2p', icon: MessageSquare },
  { id: 'logging', icon: ScrollText },
  { id: 'advanced', icon: SlidersHorizontal },
  { id: 'experimental', icon: FlaskConical },
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
                'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-app-regular transition-colors',
                section === s.id
                  ? ui.segmentActive
                  : cn(ui.segmentInactive, 'hover:bg-muted'),
              )}
            >
              <Icon className="size-4 shrink-0" />
              {s.label}
            </button>
          )
        })}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto no-drag select-none">
        {section === 'appearance' && <AppearanceSettings />}
        {section === 'terminal' && <TerminalSettings />}
        {section === 'ssh' && <SshSettings />}
        {section === 'shell' && <ShellSettings />}
        {section === 'preview' && <PreviewSettings />}
        {section === 'performance' && <PerformanceSettings />}
        {section === 'filesystem' && <FilesystemSettings />}
        {section === 'drawing' && <DrawingSettings />}
        {section === 'connections' && <ConnectionSettings />}
        {section === 'vault' && <VaultSettings />}
        {section === 'shortcuts' && <ShortcutSettings />}
        {section === 'statistics' && <StatisticsSettings />}
        {section === 'reminder' && <ReminderSettings />}
        {section === 'assistive' && <AssistiveSettings />}
        {section === 'system' && <SystemSettings />}
        {section === 'p2p' && <P2pSettings />}
        {section === 'logging' && <LogSettings />}
        {section === 'advanced' && <AdvancedSettings />}
        {section === 'experimental' && <ExperimentalSettings />}
      </div>
    </div>
  )
}
