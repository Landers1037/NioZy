export const POMODORO_MIN_MINUTES = 5
export const POMODORO_MAX_MINUTES = 120
export const POMODORO_DEFAULT_MINUTES = 25

export type PomodoroStatus = 'idle' | 'running' | 'paused'

export type PomodoroWorkerCommand =
  | { type: 'start'; durationMs: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset'; durationMs: number }
  | { type: 'set-duration'; durationMs: number }

export type PomodoroWorkerEvent =
  | { type: 'tick'; remainingMs: number; totalMs: number }
  | { type: 'paused'; remainingMs: number; totalMs: number }
  | { type: 'idle'; durationMs: number }
  | { type: 'complete'; totalMs: number }
