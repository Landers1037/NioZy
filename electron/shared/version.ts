/** 从标签、文件名等文本中提取语义化版本号（x.y.z） */
export const VERSION_PATTERN = /(\d+\.\d+\.\d+)/

/** Windows 安装包命名：NioZy-0.1.0-x64.exe */
export const INSTALLER_FILENAME_PATTERN = /^NioZy-(\d+\.\d+\.\d+)-x64\.exe$/i

export function parseVersion(text: string): string | null {
  const match = text.match(VERSION_PATTERN)
  return match?.[1] ?? null
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10))
  const pb = b.split('.').map((n) => Number.parseInt(n, 10))
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

export function pickLatestVersion(versions: string[]): string | null {
  let best: string | null = null
  for (const v of versions) {
    if (!best || compareVersions(v, best) > 0) best = v
  }
  return best
}
