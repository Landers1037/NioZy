export const TERMINAL_BUILTIN_FONT_IDS = [
  '0xProtoNerd',
  'comicShannsNerd',
  'departureNerd',
  'firaCodeNerd',
  'ubuntuMonoNerd',
] as const

export type TerminalBuiltinFontId = (typeof TERMINAL_BUILTIN_FONT_IDS)[number]

export const DEFAULT_TERMINAL_BUILTIN_FONT: TerminalBuiltinFontId = '0xProtoNerd'

export interface TerminalBuiltinFontDefinition {
  id: TerminalBuiltinFontId
  /** 设置 UI 中显示的名称 */
  label: string
  /** @font-face 与终端渲染使用的 CSS font-family */
  cssFamily: string
}

export const TERMINAL_BUILTIN_FONTS: Record<TerminalBuiltinFontId, TerminalBuiltinFontDefinition> = {
  '0xProtoNerd': {
    id: '0xProtoNerd',
    label: '0xProto Nerd',
    /** 无空格，避免 canvas font / CSS 变量解析异常 */
    cssFamily: 'NioZy0xProtoNerdMono',
  },
  comicShannsNerd: {
    id: 'comicShannsNerd',
    label: 'Comic Shanns Mono Nerd',
    cssFamily: 'NioZyComicShannsNerdMono',
  },
  departureNerd: {
    id: 'departureNerd',
    label: 'Departure Mono Nerd',
    cssFamily: 'NioZyDepartureNerdMono',
  },
  firaCodeNerd: {
    id: 'firaCodeNerd',
    label: 'Fira Code Nerd',
    cssFamily: 'NioZyFiraCodeNerdMono',
  },
  ubuntuMonoNerd: {
    id: 'ubuntuMonoNerd',
    label: 'Ubuntu Mono Nerd',
    cssFamily: 'NioZyUbuntuMonoNerdMono',
  },
}

/** xterm canvas 与 CSS var(--term-font-family) 对含空格的族名需加引号 */
export function formatTerminalFontFamilyCSSValue(family: string): string {
  const trimmed = family.trim()
  if (!trimmed) return trimmed
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
  }
  if (/[\s,]/.test(trimmed)) {
    return `"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return trimmed
}

export const TERMINAL_BUILTIN_FONT_OPTIONS = TERMINAL_BUILTIN_FONT_IDS.map(
  (id) => TERMINAL_BUILTIN_FONTS[id],
)

export function normalizeTerminalBuiltinFont(value: unknown): TerminalBuiltinFontId {
  if (typeof value === 'string' && value in TERMINAL_BUILTIN_FONTS) {
    return value as TerminalBuiltinFontId
  }
  return DEFAULT_TERMINAL_BUILTIN_FONT
}

export function getTerminalBuiltinFontFamily(id: TerminalBuiltinFontId): string {
  return TERMINAL_BUILTIN_FONTS[id].cssFamily
}

export function resolveTerminalFontFamily(terminal: {
  fontFamily: string
  useBuiltinFont?: boolean
  builtinFont?: TerminalBuiltinFontId
}): string {
  if (terminal.useBuiltinFont) {
    return getTerminalBuiltinFontFamily(normalizeTerminalBuiltinFont(terminal.builtinFont))
  }
  return terminal.fontFamily || 'Consolas'
}

/** 供 xterm / wterm 渲染使用的 font-family 值 */
export function resolveTerminalFontFamilyCSSValue(terminal: {
  fontFamily: string
  useBuiltinFont?: boolean
  builtinFont?: TerminalBuiltinFontId
}): string {
  return formatTerminalFontFamilyCSSValue(resolveTerminalFontFamily(terminal))
}
