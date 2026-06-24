export const MARKDOWN_THEME_STORAGE_KEY = 'niozy.markdown.themeId'

export interface MarkdownThemeConfig {
  id: string
  label: string
  variables: Record<string, string>
  mermaidTheme?: 'default' | 'dark' | 'forest' | 'neutral' | 'base'
  codeMirrorVariant?: 'light' | 'dark'
}

const BASE_LIGHT_VARS: Record<string, string> = {
  '--md-font-body': 'var(--font-app-regular, "Noto Sans SC", system-ui, sans-serif)',
  '--md-font-mono': 'var(--font-mono, "NioZy0xProtoNerdMono", ui-monospace, monospace)',
  '--md-font-size': '16px',
  '--md-line-height': '1.75',
  '--md-text-color': 'hsl(var(--foreground))',
  '--md-heading-color': 'hsl(var(--foreground))',
  '--md-muted-color': 'hsl(var(--muted-foreground))',
  '--md-link-color': 'hsl(var(--primary))',
  '--md-accent': 'hsl(var(--primary))',
  '--md-code-bg': 'hsl(var(--muted))',
  '--md-code-color': 'hsl(var(--foreground))',
  '--md-blockquote-border': 'hsl(var(--border))',
  '--md-blockquote-bg': 'hsl(var(--muted) / 0.35)',
  '--md-table-border': 'hsl(var(--border))',
  '--md-hr-color': 'hsl(var(--border))',
  '--md-max-width': '860px',
  '--md-padding-x': '48px',
  '--md-padding-y': '64px',
}

const BASE_DARK_VARS: Record<string, string> = {
  ...BASE_LIGHT_VARS,
  '--md-code-bg': 'hsl(var(--muted) / 0.6)',
  '--md-blockquote-bg': 'hsl(var(--muted) / 0.25)',
}

export const MARKDOWN_THEME_PRESETS: MarkdownThemeConfig[] = [
  {
    id: 'default-light',
    label: 'Default Light',
    variables: BASE_LIGHT_VARS,
    mermaidTheme: 'neutral',
    codeMirrorVariant: 'light',
  },
  {
    id: 'default-dark',
    label: 'Default Dark',
    variables: BASE_DARK_VARS,
    mermaidTheme: 'dark',
    codeMirrorVariant: 'dark',
  },
  {
    id: 'typora-light',
    label: 'Typora Light',
    variables: {
      ...BASE_LIGHT_VARS,
      '--md-font-body': '"Noto Serif", "Noto Sans SC", Georgia, serif',
      '--md-line-height': '1.8',
      '--md-link-color': '#4183c4',
    },
    mermaidTheme: 'neutral',
    codeMirrorVariant: 'light',
  },
  {
    id: 'typora-dark',
    label: 'Typora Dark',
    variables: {
      ...BASE_DARK_VARS,
      '--md-font-body': '"Noto Serif", "Noto Sans SC", Georgia, serif',
      '--md-line-height': '1.8',
      '--md-link-color': '#6cb6ff',
    },
    mermaidTheme: 'dark',
    codeMirrorVariant: 'dark',
  },
]

export function getDefaultMarkdownThemeId(isDark = false): string {
  return isDark ? 'default-dark' : 'default-light'
}

export function getMarkdownThemeById(id: string): MarkdownThemeConfig {
  return MARKDOWN_THEME_PRESETS.find((t) => t.id === id) ?? MARKDOWN_THEME_PRESETS[0]
}

export function createMarkdownTheme(
  partial: Partial<MarkdownThemeConfig> & Pick<MarkdownThemeConfig, 'id' | 'label'>,
): MarkdownThemeConfig {
  const base = getMarkdownThemeById(partial.id) ?? MARKDOWN_THEME_PRESETS[0]
  return {
    ...base,
    ...partial,
    variables: { ...base.variables, ...partial.variables },
  }
}

export function applyMarkdownTheme(el: HTMLElement, theme: MarkdownThemeConfig): void {
  el.dataset.markdownTheme = theme.id
  for (const [key, value] of Object.entries(theme.variables)) {
    el.style.setProperty(key, value)
  }
}

export function resolveMarkdownThemeForApp(
  themeId: string | undefined,
  appTheme: 'light' | 'dark' | undefined,
  accentColor?: string,
): MarkdownThemeConfig {
  const fallbackId = getDefaultMarkdownThemeId(appTheme === 'dark')
  const theme = getMarkdownThemeById(themeId ?? fallbackId)
  if (!accentColor) return theme
  return createMarkdownTheme({
    ...theme,
    variables: {
      ...theme.variables,
      '--md-link-color': accentColor,
      '--md-accent': accentColor,
    },
  })
}

export function loadPersistedMarkdownThemeId(): string | null {
  try {
    return localStorage.getItem(MARKDOWN_THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

export function persistMarkdownThemeId(themeId: string): void {
  try {
    localStorage.setItem(MARKDOWN_THEME_STORAGE_KEY, themeId)
  } catch {
    /* ignore */
  }
}
