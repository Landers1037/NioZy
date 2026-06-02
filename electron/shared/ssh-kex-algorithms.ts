/** ssh2 支持的密钥交换算法（顺序即协商优先级，从上到下优先） */
export const SSH_KEX_ALGORITHM_IDS = [
  'curve25519-sha256',
  'curve25519-sha256@libssh.org',
  'ecdh-sha2-nistp256',
  'ecdh-sha2-nistp384',
  'ecdh-sha2-nistp521',
  'diffie-hellman-group-exchange-sha256',
  'diffie-hellman-group14-sha256',
  'diffie-hellman-group15-sha512',
  'diffie-hellman-group16-sha512',
  'diffie-hellman-group17-sha512',
  'diffie-hellman-group18-sha512',
  'diffie-hellman-group-exchange-sha1',
  'diffie-hellman-group14-sha1',
  'diffie-hellman-group1-sha1',
] as const

export type SshKexAlgorithmId = (typeof SSH_KEX_ALGORITHM_IDS)[number]

/** 现代化算法默认启用；其余供老旧服务端（如 Win2016 OpenSSH 7.7）按需勾选 */
export const MODERN_SSH_KEX_ALGORITHM_IDS: readonly SshKexAlgorithmId[] = [
  'curve25519-sha256',
  'curve25519-sha256@libssh.org',
  'ecdh-sha2-nistp256',
  'ecdh-sha2-nistp384',
  'ecdh-sha2-nistp521',
  'diffie-hellman-group-exchange-sha256',
  'diffie-hellman-group14-sha256',
  'diffie-hellman-group15-sha512',
  'diffie-hellman-group16-sha512',
  'diffie-hellman-group17-sha512',
  'diffie-hellman-group18-sha512',
] as const

export const LEGACY_SSH_KEX_ALGORITHM_IDS: readonly SshKexAlgorithmId[] = [
  'diffie-hellman-group-exchange-sha1',
  'diffie-hellman-group14-sha1',
  'diffie-hellman-group1-sha1',
] as const

export const DEFAULT_ENABLED_SSH_KEX_ALGORITHMS: SshKexAlgorithmId[] = [
  ...MODERN_SSH_KEX_ALGORITHM_IDS,
]

const KEX_ID_SET = new Set<string>(SSH_KEX_ALGORITHM_IDS)

export function isSshKexAlgorithmId(value: string): value is SshKexAlgorithmId {
  return KEX_ID_SET.has(value)
}

/** 按全局定义顺序过滤出启用的 KEX 列表；至少保留一项 */
export function resolveEnabledKexAlgorithms(enabled: string[] | undefined): string[] {
  const requested = enabled?.filter(isSshKexAlgorithmId) ?? DEFAULT_ENABLED_SSH_KEX_ALGORITHMS
  const enabledSet = new Set(requested)
  const ordered = SSH_KEX_ALGORITHM_IDS.filter((id) => enabledSet.has(id))
  return ordered.length > 0 ? [...ordered] : [...DEFAULT_ENABLED_SSH_KEX_ALGORITHMS]
}

export function normalizeEnabledKexAlgorithms(value: unknown): SshKexAlgorithmId[] {
  if (!Array.isArray(value)) return [...DEFAULT_ENABLED_SSH_KEX_ALGORITHMS]
  const ids = value.filter((item): item is SshKexAlgorithmId => typeof item === 'string' && isSshKexAlgorithmId(item))
  return resolveEnabledKexAlgorithms(ids) as SshKexAlgorithmId[]
}
