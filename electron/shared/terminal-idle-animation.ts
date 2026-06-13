export type TerminalIdleAnimationMode = 'blackHole' | 'pacman' | 'logo'

export interface TerminalIdleAnimationSettings {
  enabled: boolean
  mode: TerminalIdleAnimationMode
  /** 触发闲置动画前的等待时间（毫秒） */
  idleDelayMs: number
}

export const DEFAULT_TERMINAL_IDLE_DELAY_MS = 5_000
export const MIN_TERMINAL_IDLE_DELAY_MS = 1_000
export const MAX_TERMINAL_IDLE_DELAY_MS = 120_000

export const DEFAULT_TERMINAL_IDLE_ANIMATION: TerminalIdleAnimationSettings = {
  enabled: false,
  mode: 'blackHole',
  idleDelayMs: DEFAULT_TERMINAL_IDLE_DELAY_MS,
}

const IDLE_ANIMATION_MODES: TerminalIdleAnimationMode[] = ['blackHole', 'pacman', 'logo']

export function normalizeTerminalIdleAnimationMode(value: unknown): TerminalIdleAnimationMode {
  return IDLE_ANIMATION_MODES.includes(value as TerminalIdleAnimationMode)
    ? (value as TerminalIdleAnimationMode)
    : DEFAULT_TERMINAL_IDLE_ANIMATION.mode
}

export function normalizeTerminalIdleDelayMs(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : DEFAULT_TERMINAL_IDLE_DELAY_MS
  return Math.min(
    MAX_TERMINAL_IDLE_DELAY_MS,
    Math.max(MIN_TERMINAL_IDLE_DELAY_MS, Math.round(n)),
  )
}

export function normalizeTerminalIdleAnimation(
  value: unknown,
): TerminalIdleAnimationSettings {
  const stored = value as Partial<TerminalIdleAnimationSettings> | undefined
  return {
    enabled:
      typeof stored?.enabled === 'boolean'
        ? stored.enabled
        : DEFAULT_TERMINAL_IDLE_ANIMATION.enabled,
    mode: normalizeTerminalIdleAnimationMode(stored?.mode),
    idleDelayMs: normalizeTerminalIdleDelayMs(stored?.idleDelayMs),
  }
}
