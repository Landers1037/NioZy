import { useTranslation } from 'react-i18next'
import { AppWindow, Boxes, Link2, Monitor, Network, Server } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ShellMenuIcon } from '@/components/shell/ShellMenuIcon'
import { useAppStore } from '@/stores/app-store'
import { createConnection } from '@/lib/terminal-actions'
import { BUILTIN_SHELL_TYPES } from '../../../electron/shared/builtin-shells'
import type { CustomConnection } from '../../../electron/shared/api-types'

export function NewConnectionMenuContent() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const vncEnabled = settings?.experimental.vncWebEnabled === true

  return (
    <>
      {BUILTIN_SHELL_TYPES.map((shell) => (
        <DropdownMenuItem key={shell} onClick={() => createConnection(shell)}>
          <ShellMenuIcon shell={shell} />
          {t(`settings.connections.shell.${shell}`)}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      {settings?.connections
        .filter((c) => c.type !== 'vnc' || vncEnabled)
        .map((c) => (
        <CustomConnectionMenuItem key={c.id} connection={c} />
      ))}
      {settings?.connections.length === 0 && (
        <DropdownMenuItem disabled>
          {t('settings.connections.noCustomConnections')}
        </DropdownMenuItem>
      )}
    </>
  )
}

function connectionMenuIcon(connection: CustomConnection) {
  switch (connection.type) {
    case 'ssh':
      return Server
    case 'rdp':
      return Monitor
    case 'wsl':
      return Boxes
    case 'telnet':
      return Network
    case 'putty':
      return AppWindow
    case 'vnc':
      return Monitor
    default:
      return Link2
  }
}

function CustomConnectionMenuItem({ connection }: { connection: CustomConnection }) {
  const Icon = connectionMenuIcon(connection)

  return (
    <DropdownMenuItem onClick={() => createConnection('custom', connection)}>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {connection.name}
    </DropdownMenuItem>
  )
}
