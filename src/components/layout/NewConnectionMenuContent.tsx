import { useTranslation } from 'react-i18next'
import { Link2, Monitor, Server } from 'lucide-react'
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

  return (
    <>
      {BUILTIN_SHELL_TYPES.map((shell) => (
        <DropdownMenuItem key={shell} onClick={() => createConnection(shell)}>
          <ShellMenuIcon shell={shell} />
          {t(`settings.connections.shell.${shell}`)}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      {settings?.connections.map((c) => (
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

function CustomConnectionMenuItem({ connection }: { connection: CustomConnection }) {
  const Icon =
    connection.type === 'ssh' ? Server : connection.type === 'rdp' ? Monitor : Link2

  return (
    <DropdownMenuItem onClick={() => createConnection('custom', connection)}>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {connection.name}
    </DropdownMenuItem>
  )
}
