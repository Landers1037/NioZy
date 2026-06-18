/** 从 Git 仓库 URL 解析仓库目录名（不含 .git 后缀） */
export function parseRepoNameFromUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\/$/, '')
  if (!trimmed) return null

  const sshMatch = trimmed.match(/^git@[^:]+:(.+?)(?:\.git)?$/i)
  if (sshMatch) {
    const segments = sshMatch[1]!.split('/').filter(Boolean)
    const name = segments[segments.length - 1]
    return name ? name.replace(/\.git$/i, '') : null
  }

  try {
    let pathname: string
    if (trimmed.startsWith('git://')) {
      pathname = trimmed.replace(/^git:\/\/[^/]+/, '')
    } else {
      pathname = new URL(trimmed).pathname
    }
    const segment = pathname.split('/').filter(Boolean).pop()
    if (!segment) return null
    return segment.replace(/\.git$/i, '')
  } catch {
    return null
  }
}

/** 校验是否为支持的 Git 克隆地址（https / http / git:// / git@） */
export function isValidGitCloneUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (/^git@[^:]+:.+/i.test(trimmed)) return true
  if (/^git:\/\/.+/i.test(trimmed)) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
