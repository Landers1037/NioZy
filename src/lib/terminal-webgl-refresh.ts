import type { Terminal } from '@xterm/xterm'
import type { WebglAddon } from '@xterm/addon-webgl'
import type { AppSettings } from '../../electron/shared/api-types'
import { resolveTerminalFontFamily } from '../../electron/shared/terminal-builtin-fonts'

type TerminalFontWaitSettings = Pick<
  AppSettings['terminal'],
  'fontFamily' | 'useBuiltinFont' | 'builtinFont' | 'fontSize' | 'fontWeight' | 'fontWeightBold'
>

function fontLoadSpec(
  family: string,
  fontSize: number,
  fontWeight: number | undefined,
  fallback: number,
): string {
  return `${fontWeight ?? fallback} ${fontSize}px ${family}`
}

/** 内置 Nerd Font 未就绪时 WebGL 图集会按错误 metrics 缓存字形 */
export async function waitForTerminalFonts(
  terminal?: TerminalFontWaitSettings | null,
  timeoutMs = 4000,
): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  if (!terminal?.useBuiltinFont) return

  const fontSize = terminal.fontSize ?? 13
  const family = resolveTerminalFontFamily(terminal)
  const loads = [
    document.fonts.ready,
    document.fonts.load(fontLoadSpec(family, fontSize, terminal.fontWeight, 400)),
    document.fonts.load(fontLoadSpec(family, fontSize, terminal.fontWeightBold, 700)),
  ]

  await Promise.race([
    Promise.all(loads),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs)
    }),
  ])
}

/** WebGL 纹理图集在单元格尺寸变化或 addon 刚挂载后需重建，否则 Braille/块字符会错位 */
export function refreshWebglTextureAtlas(
  term: Terminal,
  webgl: WebglAddon | null | undefined,
): void {
  if (!webgl) return
  try {
    webgl.clearTextureAtlas()
    term.refresh(0, Math.max(0, term.rows - 1))
  } catch {
    /* WebGL 上下文已丢失时可能报错 */
  }
}

export function scheduleWebglTextureAtlasRefresh(
  term: Terminal,
  webgl: WebglAddon | null | undefined,
  fit: () => boolean,
  maxAttempts = 16,
): void {
  let attempts = 0
  const tryRefresh = () => {
    if (!webgl || attempts >= maxAttempts) {
      refreshWebglTextureAtlas(term, webgl)
      return
    }
    attempts += 1
    if (fit()) {
      refreshWebglTextureAtlas(term, webgl)
      return
    }
    requestAnimationFrame(tryRefresh)
  }
  requestAnimationFrame(tryRefresh)
}
