/** 本机侧「此电脑」根视图：列出所有盘符 */
export const SCP_LOCAL_ROOTS = ''

export function isScpLocalRoots(path: string): boolean {
  return path === SCP_LOCAL_ROOTS
}

/** SSH 终端状态栏占位 cwd（如 ssh://user@host），不是 Windows 本机路径 */
export function isSshTerminalDisplayCwd(path: string): boolean {
  return path.startsWith('ssh://')
}

/** SCP 传输面板左侧本机目录的初始路径 */
export function initialScpLocalPath(
  terminalId: string | undefined,
  terminalCwds: Record<string, string>,
  isSshTab: boolean,
): string {
  if (isSshTab) return SCP_LOCAL_ROOTS
  const cwd = terminalId ? terminalCwds[terminalId] : ''
  if (!cwd || isSshTerminalDisplayCwd(cwd)) return SCP_LOCAL_ROOTS
  return cwd
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
