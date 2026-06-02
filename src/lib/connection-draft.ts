import type { CustomConnection } from '@/stores/app-store'
import { formatEnvLines, parseEnvLines } from '@/lib/connection-env'

export type ConnectionDraft = {
  type: 'command' | 'ssh' | 'rdp'
  name: string
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
}

export const EMPTY_CONNECTION_DRAFT: ConnectionDraft = {
  type: 'command',
  name: '',
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
  if (c.type === 'ssh') {
    return {
      ...EMPTY_CONNECTION_DRAFT,
      type: 'ssh',
      name: c.name,
      sshUser: c.sshUser ?? '',
      sshHost: c.sshHost ?? c.command,
      sshPort: c.sshPort ?? 22,
      sshAuth: c.sshAuth ?? (c.sshKeyPath?.trim() ? 'publickey' : 'password'),
      sshPassword: c.sshPassword ?? '',
      sshKeyPath: c.sshKeyPath ?? '',
      sshGroup: c.sshGroup ?? '',
    }
  }
  if (c.type === 'rdp') {
    return {
      ...EMPTY_CONNECTION_DRAFT,
      type: 'rdp',
      name: c.name,
      rdpHost: c.rdpHost ?? c.command,
      rdpPort: c.rdpPort ?? 3389,
      rdpUser: c.rdpUser ?? '',
      rdpPassword: c.rdpPassword ?? '',
    }
  }
  return {
    ...EMPTY_CONNECTION_DRAFT,
    type: 'command',
    name: c.name,
    command: c.command,
    argsStr: c.args.join(' '),
    envStr: formatEnvLines(c.env),
  }
}

/** 校验并生成连接；无效时返回 null */
export function draftToConnection(
  draft: ConnectionDraft,
  id: string,
): CustomConnection | null {
  if (!draft.name.trim()) return null

  if (draft.type === 'ssh') {
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

  if (draft.type === 'rdp') {
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

  if (!draft.command.trim()) return null
  return {
    id,
    name: draft.name.trim(),
    type: 'command',
    command: draft.command.trim(),
    args: draft.argsStr.split(' ').filter(Boolean),
    env: parseEnvLines(draft.envStr),
  }
}
