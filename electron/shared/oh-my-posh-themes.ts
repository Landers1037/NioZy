import themesJson from './oh-my-posh-themes.json'

export interface OhMyPoshThemeDefinition {
  id: string
  file: string
  label: string
}

export const OH_MY_POSH_THEMES = themesJson as OhMyPoshThemeDefinition[]

export type OhMyPoshThemeId =
  | 'jandedobbeleer'
  | 'powerlevel10k_modern'
  | 'powerlevel10k_lean'
  | 'powerlevel10k_rainbow'
  | 'agnoster'
  | 'paradox'
  | 'pure'
  | 'dracula'
  | 'catppuccin_mocha'
  | 'catppuccin_latte'
  | 'gruvbox'
  | 'night-owl'
  | 'tokyo'
  | 'tokyonight_storm'
  | 'spaceship'
  | 'robbyrussell'
  | 'atomic'
  | 'cobalt2'
  | 'material'

export const DEFAULT_OH_MY_POSH_THEME: OhMyPoshThemeId = 'jandedobbeleer'

const THEME_IDS = new Set(OH_MY_POSH_THEMES.map((theme) => theme.id))

export function normalizeOhMyPoshTheme(value: unknown): OhMyPoshThemeId {
  if (typeof value === 'string' && THEME_IDS.has(value)) {
    return value as OhMyPoshThemeId
  }
  return DEFAULT_OH_MY_POSH_THEME
}

export function getOhMyPoshThemeFile(themeId: OhMyPoshThemeId): string {
  const theme = OH_MY_POSH_THEMES.find((item) => item.id === themeId)
  if (theme) return theme.file
  return OH_MY_POSH_THEMES.find((item) => item.id === DEFAULT_OH_MY_POSH_THEME)!.file
}

export function getOhMyPoshThemeLabel(themeId: OhMyPoshThemeId): string {
  const theme = OH_MY_POSH_THEMES.find((item) => item.id === themeId)
  return theme?.label ?? DEFAULT_OH_MY_POSH_THEME
}
