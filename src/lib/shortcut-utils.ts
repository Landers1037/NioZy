const MOD_MAP: Record<string, keyof Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> = {
  CommandOrControl: 'ctrlKey',
  Control: 'ctrlKey',
  Ctrl: 'ctrlKey',
  Command: 'metaKey',
  Cmd: 'metaKey',
  Alt: 'altKey',
  Option: 'altKey',
  Shift: 'shiftKey',
}

const KEY_ALIASES: Record<string, string> = {
  plus: '+',
  comma: ',',
  space: ' ',
  return: 'enter',
  enter: 'enter',
  esc: 'escape',
  escape: 'escape',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  delete: 'delete',
  backspace: 'backspace',
  tab: 'tab',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower]
  if (lower.length === 1) return lower
  if (lower.startsWith('f') && /^f\d{1,2}$/.test(lower)) return lower
  return lower
}

function parseAccelerator(accelerator: string): {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  key: string
} {
  const parts = accelerator.split('+').map((p) => p.trim()).filter(Boolean)
  const mods = { ctrl: false, alt: false, shift: false, meta: false }
  let key = ''

  for (const part of parts) {
    const mod = MOD_MAP[part]
    if (mod) {
      if (mod === 'ctrlKey') mods.ctrl = true
      if (mod === 'altKey') mods.alt = true
      if (mod === 'shiftKey') mods.shift = true
      if (mod === 'metaKey') mods.meta = true
    } else {
      key = normalizeKey(part)
    }
  }

  return { ...mods, key }
}

/** 全局快捷键须含修饰键，不能仅为单个按键（如 T、Home、F1）。空字符串视为有效（未设置）。 */
export function isValidGlobalAccelerator(accelerator: string): boolean {
  const trimmed = accelerator.trim()
  if (!trimmed) return true
  const spec = parseAccelerator(trimmed)
  if (!spec.key) return false
  return spec.ctrl || spec.alt || spec.shift || spec.meta
}

export function matchAccelerator(accelerator: string, event: KeyboardEvent): boolean {
  if (!accelerator.trim()) return false
  const spec = parseAccelerator(accelerator)
  if (!spec.key) return false

  const eventKey = normalizeKey(event.key)
  if (eventKey !== spec.key) return false

  const ctrlOrMeta = event.ctrlKey || event.metaKey
  const wantCtrlOrMeta = spec.ctrl || spec.meta

  if (wantCtrlOrMeta && !ctrlOrMeta) return false
  if (!wantCtrlOrMeta && ctrlOrMeta) return false
  if (spec.alt !== event.altKey) return false
  if (spec.shift !== event.shiftKey) return false

  return true
}

export function formatAcceleratorForDisplay(accelerator: string): string {
  return accelerator
    .replace(/CommandOrControl/gi, 'Ctrl')
    .replace(/Command/gi, 'Cmd')
    .replace(/\+/g, ' + ')
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS'])

/** 将浏览器 KeyboardEvent 转为 Electron 加速器字符串；仅修饰键时返回 null。 */
export function keyboardEventToAccelerator(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null

  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  const key = eventKeyToAcceleratorToken(event.key)
  if (!key) return null
  parts.push(key)

  return parts.join('+')
}

function eventKeyToAcceleratorToken(key: string): string | null {
  if (key === ' ') return 'Space'
  if (key === ',') return ','
  if (key === '+') return 'Plus'
  if (key.length === 1) return key.toUpperCase()

  const named: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Enter: 'Return',
    Escape: 'Esc',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  }
  if (named[key]) return named[key]
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase()

  return key
}
