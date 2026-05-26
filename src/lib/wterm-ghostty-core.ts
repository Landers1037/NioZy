import type { TerminalCore } from '@wterm/core'
import type { GhosttyOptions } from '@wterm/ghostty'

/** @wterm/ghostty 未在 package exports 中声明 wasm 子路径，需相对路径导入 */
export { default as ghosttyWasmUrl } from '../../node_modules/@wterm/ghostty/wasm/ghostty-vt.wasm?url'

export async function loadWtermGhosttyCore(
  options: GhosttyOptions = {},
): Promise<TerminalCore> {
  const { GhosttyCore } = await import('@wterm/ghostty')
  return GhosttyCore.load(options)
}
