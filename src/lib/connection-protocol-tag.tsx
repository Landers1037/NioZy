import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CustomConnection } from '@/stores/app-store'
import { cn } from '@/lib/utils'

export type ConnectionProtocolType = CustomConnection['type']

const TAG_STYLES: Record<ConnectionProtocolType, string> = {
  ssh: 'border-sky-600/25 bg-sky-600/14 text-sky-950 dark:border-sky-400/30 dark:bg-sky-400/20 dark:text-sky-50',
  sftp: 'border-teal-600/25 bg-teal-600/14 text-teal-950 dark:border-teal-400/30 dark:bg-teal-400/20 dark:text-teal-50',
  ftp: 'border-cyan-600/25 bg-cyan-600/14 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/20 dark:text-cyan-50',
  rdp: 'border-violet-600/25 bg-violet-600/14 text-violet-950 dark:border-violet-400/30 dark:bg-violet-400/20 dark:text-violet-50',
  wsl: 'border-emerald-600/25 bg-emerald-600/14 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-50',
  telnet:
    'border-orange-600/25 bg-orange-600/14 text-orange-950 dark:border-orange-400/30 dark:bg-orange-400/20 dark:text-orange-50',
  putty:
    'border-indigo-600/25 bg-indigo-600/14 text-indigo-950 dark:border-indigo-400/30 dark:bg-indigo-400/20 dark:text-indigo-50',
  vnc: 'border-fuchsia-600/25 bg-fuchsia-600/14 text-fuchsia-950 dark:border-fuchsia-400/30 dark:bg-fuchsia-400/20 dark:text-fuchsia-50',
  command:
    'border-amber-600/25 bg-amber-600/14 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-50',
}

export function connectionProtocolTagLabel(type: ConnectionProtocolType, t: TFunction): string {
  switch (type) {
    case 'ssh':
      return t('settings.connections.typeSsh')
    case 'sftp':
      return t('settings.connections.protocolTagSftp')
    case 'ftp':
      return t('settings.connections.protocolTagFtp')
    case 'rdp':
      return t('settings.connections.protocolTagRdp')
    case 'wsl':
      return t('settings.connections.protocolTagWsl')
    case 'telnet':
      return t('settings.connections.protocolTagTelnet')
    case 'putty':
      return t('settings.connections.protocolTagPutty')
    case 'vnc':
      return t('settings.connections.protocolTagVnc')
    case 'command':
      return t('settings.connections.protocolTagCommand')
  }
}

export function connectionSavedSummary(c: CustomConnection, t: TFunction): string {
  switch (c.type) {
    case 'ssh':
    case 'sftp':
      return [
        `${c.sshUser}@${c.sshHost}`,
        c.sshGroup?.trim() ? c.sshGroup.trim() : null,
      ]
        .filter(Boolean)
        .join(t('common.listSeparator'))
    case 'ftp': {
      const host = c.ftpHost ?? c.command
      const port = c.ftpPort ?? 21
      const target = port === 21 ? host : `${host}:${port}`
      const prefix = c.ftpUser?.trim() ? `${c.ftpUser.trim()}@${target}` : target
      const mode = c.ftpSecurity === 'implicit' ? 'FTPS' : c.ftpSecurity === 'explicit' ? 'FTPES' : 'FTP'
      return `${prefix}${t('common.listSeparator')}${mode}`
    }
    case 'rdp': {
      const host = c.rdpHost ?? c.command
      const port = c.rdpPort ?? 3389
      const target = port === 3389 ? host : `${host}:${port}`
      return `${c.rdpUser}@${target}`
    }
    case 'wsl':
      return c.wslDistro?.trim()
        ? `wsl -d ${c.wslDistro.trim()}`
        : t('settings.connections.wslDefaultDistro')
    case 'telnet': {
      const host = c.telnetHost ?? c.command
      const port = c.telnetPort ?? 23
      return port === 23 ? host : `${host}:${port}`
    }
    case 'putty': {
      const host = c.puttyHost ?? c.command
      const protocol = c.puttyProtocol ?? 'ssh'
      const defaultPort = protocol === 'telnet' ? 23 : 22
      const port = c.puttyPort ?? defaultPort
      const target = port === defaultPort ? host : `${host}:${port}`
      const user = c.puttyUser?.trim()
      if (protocol === 'telnet') return target
      return user ? `${user}@${target}` : target
    }
    case 'vnc': {
      const host = c.vncHost ?? c.command
      const port = c.vncPort ?? 5900
      return port === 5900 ? host : `${host}:${port}`
    }
    default:
      return c.command
  }
}

export function ConnectionProtocolTag({
  type,
  className,
}: {
  type: ConnectionProtocolType
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none',
        TAG_STYLES[type],
        className,
      )}
    >
      {connectionProtocolTagLabel(type, t)}
    </span>
  )
}
