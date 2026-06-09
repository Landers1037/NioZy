import type { Terminal } from '@xterm/xterm'
import type { WebglAddon } from '@xterm/addon-webgl'

/** 内置 Nerd Font 未就绪时 WebGL 图集会按错误 metrics 缓存 Braille 字形 */
export async function waitForTerminalFonts(timeoutMs = 4000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) return
  await Promise.race([
    document.fonts.ready,
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
