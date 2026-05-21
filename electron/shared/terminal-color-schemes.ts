/** 终端配色方案 ID（与 src/lib/terminal-themes 中的主题键一致） */
export const TERMINAL_COLOR_SCHEME_IDS = [
  'atom',
  'atom-one-light',
  'niozy-dark',
  'niozy-light',
  'solarized-dark',
  'solarized-light',
  'tokyo-night',
  'tokyo-night-storm',
  'tokyo-night-light',
  'dracula',
  'one-dark',
  'gruvbox-dark',
  'gruvbox-light',
  'monokai',
  'nord',
  'catppuccin-mocha',
  'catppuccin-latte',
  'github-dark',
  'github-light',
  'ayu-dark',
  'ayu-light',
  'cobalt2',
  'night-owl',
  'material',
] as const

export type TerminalColorScheme = (typeof TERMINAL_COLOR_SCHEME_IDS)[number]

export const TERMINAL_COLOR_SCHEME_LABELS: Record<TerminalColorScheme, string> = {
  atom: 'Atom',
  'atom-one-light': 'Atom One Light',
  'niozy-dark': 'NioZy Dark',
  'niozy-light': 'NioZy Light',
  'solarized-dark': 'Solarized Dark',
  'solarized-light': 'Solarized Light',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Night Storm',
  'tokyo-night-light': 'Tokyo Night Light',
  dracula: 'Dracula',
  'one-dark': 'One Dark',
  'gruvbox-dark': 'Gruvbox Dark',
  'gruvbox-light': 'Gruvbox Light',
  monokai: 'Monokai',
  nord: 'Nord',
  'catppuccin-mocha': 'Catppuccin Mocha',
  'catppuccin-latte': 'Catppuccin Latte',
  'github-dark': 'GitHub Dark',
  'github-light': 'GitHub Light',
  'ayu-dark': 'Ayu Dark',
  'ayu-light': 'Ayu Light',
  cobalt2: 'Cobalt2',
  'night-owl': 'Night Owl',
  material: 'Material',
}

export function isTerminalColorScheme(id: string): id is TerminalColorScheme {
  return (TERMINAL_COLOR_SCHEME_IDS as readonly string[]).includes(id)
}

export function normalizeTerminalColorScheme(id: string): TerminalColorScheme {
  return isTerminalColorScheme(id) ? id : 'atom'
}

export const COLOR_SCHEME_OPTIONS = TERMINAL_COLOR_SCHEME_IDS.map((id) => ({
  id,
  label: TERMINAL_COLOR_SCHEME_LABELS[id],
}))
