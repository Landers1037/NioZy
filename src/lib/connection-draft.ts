import type { CustomConnection, PuttyProtocol } from '../../electron/shared/api-types'
import { formatEnvLines, parseEnvLines } from '@/lib/connection-env'

export type ConnectionDraft = {
  type: CustomConnection['type']
  name: string
  /** Windows：文件夹右键「通过 NioZy 打开」（仅 type=command） */
  shellContextMenu: boolean
  command: string
  argsStr: string
  envStr: string
  sshUser: string
  sshHost: string
  sshPort: number
  sshAuth: 'password' | 'publickey'
  sshPassword: string
  sshKeyPath: string
  sshGroup: string
  rdpHost: string
  rdpPort: number
  rdpUser: string
  rdpPassword: string
  wslDistro: string
  telnetHost: string
  telnetPort: number
  puttyHost: string
  puttyPort: number
  puttyUser: string
  puttyPassword: string
  puttyProtocol: PuttyProtocol
  vncHost: string
  vncPort: number
  vncUsername: string
  vncPassword: string
}

export const EMPTY_CONNECTION_DRAFT: ConnectionDraft = {
  type: 'command',
  name: '',
  shellContextMenu: false,
  command: '',
  argsStr: '',
  envStr: '',
  sshUser: '',
  sshHost: '',
  sshPort: 22,
  sshAuth: 'password',
  sshPassword: '',
  sshKeyPath: '',
  sshGroup: '',
  rdpHost: '',
  rdpPort: 3389,
  rdpUser: '',
  rdpPassword: '',
  wslDistro: '',
  telnetHost: '',
  telnetPort: 23,
  puttyHost: '',
  puttyPort: 22,
  puttyUser: '',
  puttyPassword: '',
  puttyProtocol: 'ssh',
  vncHost: '',
  vncPort: 5900,
  vncUsername: '',
  vncPassword: '',
}

export function defaultPuttyPort(protocol: PuttyProtocol): number {
  return protocol === 'telnet' ? 23 : 22
}

/** 是否已有同名自定义命令启用了右键打开（排除当前编辑中的连接） */
export function hasDuplicateShellContextMenuName(
  connections: CustomConnection[],
  name: string,
  excludeId?: string | null,
): boolean {
  const normalized = name.trim().toLocaleLowerCase()
  if (!normalized) return false
  return connections.some(
    (c) =>
      c.type === 'command' &&
      c.shellContextMenu === true &&
      c.id !== excludeId &&
      c.name.trim().toLocaleLowerCase() === normalized,
  )
}

/** 从已保存的 SSH 连接收集不重复的分组名（按字母排序） */
export function collectSshGroups(connections: CustomConnection[]): string[] {
  const names = new Set<string>()
  for (const c of connections) {
    if (c.type === 'ssh') {
      const g = c.sshGroup?.trim()
      if (g) names.add(g)
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export function connectionToDraft(c: CustomConnection): ConnectionDraft {
  const base = { ...EMPTY_CONNECTION_DRAFT, name: c.name }

  switch (c.type) {
    case 'ssh':
      return {
        ...base,
        type: 'ssh',
        sshUser: c.sshUser ?? '',
        sshHost: c.sshHost ?? c.command,
        sshPort: c.sshPort ?? 22,
        sshAuth: c.sshAuth ?? (c.sshKeyPath?.trim() ? 'publickey' : 'password'),
        sshPassword: c.sshPassword ?? '',
        sshKeyPath: c.sshKeyPath ?? '',
        sshGroup: c.sshGroup ?? '',
      }
    case 'rdp':
      return {
        ...base,
        type: 'rdp',
        rdpHost: c.rdpHost ?? c.command,
        rdpPort: c.rdpPort ?? 3389,
        rdpUser: c.rdpUser ?? '',
        rdpPassword: c.rdpPassword ?? '',
      }
    case 'wsl':
      return {
        ...base,
        type: 'wsl',
        wslDistro: c.wslDistro ?? '',
      }
    case 'telnet':
      return {
        ...base,
        type: 'telnet',
        telnetHost: c.telnetHost ?? c.command,
        telnetPort: c.telnetPort ?? 23,
      }
    case 'putty':
      return {
        ...base,
        type: 'putty',
        puttyHost: c.puttyHost ?? c.command,
        puttyPort: c.puttyPort ?? defaultPuttyPort(c.puttyProtocol ?? 'ssh'),
        puttyUser: c.puttyUser ?? '',
        puttyPassword: c.puttyPassword ?? '',
        puttyProtocol: c.puttyProtocol ?? 'ssh',
      }
    case 'vnc':
      return {
        ...base,
        type: 'vnc',
        vncHost: c.vncHost ?? c.command,
        vncPort: c.vncPort ?? 5900,
        vncUsername: c.vncUsername ?? '',
        vncPassword: c.vncPassword ?? '',
      }
    default:
      return {
        ...base,
        type: 'command',
        shellContextMenu: c.shellContextMenu === true,
        command: c.command,
        argsStr: c.args.join(' '),
        envStr: formatEnvLines(c.env),
      }
  }
}

/** 校验并生成连接；无效时返回 null */
export function draftToConnection(
  draft: ConnectionDraft,
  id: string,
): CustomConnection | null {
  if (!draft.name.trim()) return null

  switch (draft.type) {
    case 'ssh': {
      if (!draft.sshHost.trim() || !draft.sshUser.trim()) return null
      return {
        id,
        name: draft.name.trim(),
        type: 'ssh',
        command: draft.sshHost.trim(),
        args: [],
        env: {},
        sshAuth: draft.sshAuth,
        sshUser: draft.sshUser.trim(),
        sshHost: draft.sshHost.trim(),
        sshPort: draft.sshPort,
        sshPassword:
          draft.sshAuth === 'password' && draft.sshPassword.trim()
            ? draft.sshPassword.trim()
            : undefined,
        sshKeyPath:
          draft.sshAuth === 'publickey' && draft.sshKeyPath.trim()
            ? draft.sshKeyPath.trim()
            : undefined,
        sshGroup: draft.sshGroup.trim() || undefined,
      }
    }
    case 'rdp': {
      if (!draft.rdpHost.trim() || !draft.rdpUser.trim()) return null
      return {
        id,
        name: draft.name.trim(),
        type: 'rdp',
        command: draft.rdpHost.trim(),
        args: [],
        env: {},
        rdpHost: draft.rdpHost.trim(),
        rdpPort: draft.rdpPort > 0 ? draft.rdpPort : 3389,
        rdpUser: draft.rdpUser.trim(),
        rdpPassword: draft.rdpPassword.trim() || undefined,
      }
    }
    case 'wsl':
      return {
        id,
        name: draft.name.trim(),
        type: 'wsl',
        command: draft.wslDistro.trim() || 'wsl',
        args: [],
        env: {},
        wslDistro: draft.wslDistro.trim() || undefined,
      }
    case 'telnet': {
      if (!draft.telnetHost.trim()) return null
      return {
        id,
        name: draft.name.trim(),
        type: 'telnet',
        command: draft.telnetHost.trim(),
        args: [],
        env: {},
        telnetHost: draft.telnetHost.trim(),
        telnetPort: draft.telnetPort > 0 ? draft.telnetPort : 23,
      }
    }
    case 'putty': {
      if (!draft.puttyHost.trim()) return null
      const protocol = draft.puttyProtocol
      return {
        id,
        name: draft.name.trim(),
        type: 'putty',
        command: draft.puttyHost.trim(),
        args: [],
        env: {},
        puttyHost: draft.puttyHost.trim(),
        puttyPort: draft.puttyPort > 0 ? draft.puttyPort : defaultPuttyPort(protocol),
        puttyUser: draft.puttyUser.trim() || undefined,
        puttyPassword: draft.puttyPassword.trim() || undefined,
        puttyProtocol: protocol,
      }
    }
    case 'vnc': {
      if (!draft.vncHost.trim()) return null
      const port = draft.vncPort > 0 ? draft.vncPort : 5900
      return {
        id,
        name: draft.name.trim(),
        type: 'vnc',
        command: draft.vncHost.trim(),
        args: [],
        env: {},
        vncHost: draft.vncHost.trim(),
        vncPort: port,
        vncUsername: draft.vncUsername.trim() || undefined,
        vncPassword: draft.vncPassword.trim() || undefined,
      }
    }
    default: {
      if (!draft.command.trim()) return null
      return {
        id,
        name: draft.name.trim(),
        type: 'command',
        command: draft.command.trim(),
        args: draft.argsStr.split(' ').filter(Boolean),
        env: parseEnvLines(draft.envStr),
        ...(draft.shellContextMenu ? { shellContextMenu: true } : {}),
      }
    }
  }
}
