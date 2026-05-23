/** 本机侧「此电脑」根视图：列出所有盘符 */
export const SCP_LOCAL_ROOTS = ''

export function isScpLocalRoots(path: string): boolean {
  return path === SCP_LOCAL_ROOTS
}

/** Windows 本机路径的上一级；盘符根目录的上一级为「此电脑」 */
export function parentScpLocalPath(current: string): string {
  if (isScpLocalRoots(current)) return SCP_LOCAL_ROOTS

  const p = current.replace(/\//g, '\\')
  const withoutTrailing = p.replace(/\\+$/, '') || p

  if (/^[A-Za-z]:$/.test(withoutTrailing)) return SCP_LOCAL_ROOTS
  if (/^[A-Za-z]:\\$/.test(p)) return SCP_LOCAL_ROOTS

  const lastSep = withoutTrailing.lastIndexOf('\\')
  if (lastSep < 0) return SCP_LOCAL_ROOTS

  let parent = withoutTrailing.slice(0, lastSep)
  if (/^[A-Za-z]:$/.test(parent)) parent += '\\'
  return parent
}

export function canGoUpScpLocalPath(current: string): boolean {
  return !isScpLocalRoots(current)
}
