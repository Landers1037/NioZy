/** 从 PTY 输出流解析工作目录（OSC 7 / VS Code 633 / iTerm 1337） */

const OSC_CWD_633 = /\x1b\]633;P;(?:[^\x07\x1b]*?;)*?Cwd=([^\x07\x1b]+)/g
const OSC_CWD_7 = /\x1b\]7;(?:file:\/\/[^/]*)?(\/?[^\x07\x1b]+)(?:\x07|\x1b\\)/g
const OSC_CWD_1337 = /\x1b\]1337;CurrentDir=([^\x07\x1b]+)/g

export function extractCwdFromTerminalData(data: string): string | null {
  let latest: string | null = null

  for (const match of data.matchAll(OSC_CWD_633)) {
    const decoded = decodeVSCodeEscaped(match[1])
    if (decoded) latest = decoded
  }

  for (const match of data.matchAll(OSC_CWD_7)) {
    const decoded = decodeOsc7Path(match[1])
    if (decoded) latest = decoded
  }

  for (const match of data.matchAll(OSC_CWD_1337)) {
    const decoded = decodeVSCodeEscaped(match[1])
    if (decoded) latest = decoded
  }

  if (!latest) return null
  const normalized = normalizeWindowsPath(latest)
  // Defensive: ignore relative cwd (e.g. "."), which some prompts/plugins may emit.
  return isAbsoluteWindowsPath(normalized) ? normalized : null
}

function decodeVSCodeEscaped(value: string): string {
  return value.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}

function decodeOsc7Path(segment: string): string {
  let raw = segment.trim()
  if (!raw) return ''
  try {
    raw = decodeURIComponent(raw)
  } catch {
    /* 非 URI 编码路径 */
  }
  return raw.replace(/\//g, '\\')
}

function normalizeWindowsPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return trimmed
  if (/^file:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      let p = decodeURIComponent(url.pathname)
      if (/^\/[a-zA-Z]:\//.test(p)) p = p.slice(1)
      return p.replace(/\//g, '\\')
    } catch {
      return trimmed
    }
  }
  return trimmed.replace(/\//g, '\\')
}

function isAbsoluteWindowsPath(path: string): boolean {
  const p = path.trim()
  if (!p) return false
  if (p === '.' || p === '..') return false
  // Drive path: C:\...
  if (/^[a-zA-Z]:\\/.test(p)) return true
  // UNC: \\server\share\...
  if (/^\\\\[^\\]+\\[^\\]+/.test(p)) return true
  return false
}
