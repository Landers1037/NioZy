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
