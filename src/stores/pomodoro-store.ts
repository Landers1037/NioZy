import { create } from 'zustand'
import {
  POMODORO_DEFAULT_MINUTES,
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  type PomodoroStatus,
  type PomodoroWorkerCommand,
  type PomodoroWorkerEvent,
} from '@/lib/pomodoro-timer-types'

interface PomodoroState {
  status: PomodoroStatus
  durationMinutes: number
  totalMs: number
  remainingMs: number
  init: () => void
  setDurationMinutes: (minutes: number) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
}

let worker: Worker | null = null

function notifyPomodoroComplete(totalMs: number) {
  // 脱离 Worker message 回调栈，确保 sonner 能正常挂载 Toast
  window.setTimeout(() => {
    void import('@/lib/pomodoro-complete-toast').then(({ showPomodoroCompleteToast }) => {
      showPomodoroCompleteToast(totalMs)
    })
  }, 0)
}

function clampMinutes(minutes: number): number {
  return Math.min(POMODORO_MAX_MINUTES, Math.max(POMODORO_MIN_MINUTES, Math.round(minutes)))
}

function minutesToMs(minutes: number): number {
  return clampMinutes(minutes) * 60_000
}

function postCommand(command: PomodoroWorkerCommand) {
  worker?.postMessage(command)
}

function handleWorkerEvent(
  event: PomodoroWorkerEvent,
  set: (partial: Partial<PomodoroState> | ((state: PomodoroState) => Partial<PomodoroState>)) => void,
  get: () => PomodoroState,
) {
  switch (event.type) {
    case 'tick':
      set({ status: 'running', remainingMs: event.remainingMs, totalMs: event.totalMs })
      break
    case 'paused':
      set({ status: 'paused', remainingMs: event.remainingMs, totalMs: event.totalMs })
      break
    case 'idle': {
      const minutes = clampMinutes(event.durationMs / 60_000)
      set({
        status: 'idle',
        durationMinutes: minutes,
        totalMs: event.durationMs,
        remainingMs: event.durationMs,
      })
      break
    }
    case 'complete': {
      const achievedMs = event.totalMs
      const durationMs = minutesToMs(get().durationMinutes)
      set({
        status: 'idle',
        remainingMs: durationMs,
        totalMs: durationMs,
      })
      postCommand({ type: 'reset', durationMs })
      notifyPomodoroComplete(achievedMs)
      break
    }
    default:
      break
  }
}

function ensureWorker(
  set: (partial: Partial<PomodoroState> | ((state: PomodoroState) => Partial<PomodoroState>)) => void,
  get: () => PomodoroState,
) {
  if (worker) return
  worker = new Worker(new URL('../workers/pomodoro-timer.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.onmessage = (event: MessageEvent<PomodoroWorkerEvent>) => {
    handleWorkerEvent(event.data, set, get)
  }
  const durationMs = minutesToMs(get().durationMinutes)
  postCommand({ type: 'reset', durationMs })
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  status: 'idle',
  durationMinutes: POMODORO_DEFAULT_MINUTES,
  totalMs: minutesToMs(POMODORO_DEFAULT_MINUTES),
  remainingMs: minutesToMs(POMODORO_DEFAULT_MINUTES),

  init: () => {
    ensureWorker(set, get)
  },

  setDurationMinutes: (minutes) => {
    const clamped = clampMinutes(minutes)
    const durationMs = minutesToMs(clamped)
    set({ durationMinutes: clamped, totalMs: durationMs, remainingMs: durationMs })
    if (get().status === 'idle') {
      ensureWorker(set, get)
      postCommand({ type: 'set-duration', durationMs })
    }
  },

  start: () => {
    ensureWorker(set, get)
    const durationMs =
      get().status === 'paused' ? get().remainingMs : minutesToMs(get().durationMinutes)
    if (get().status === 'paused') {
      postCommand({ type: 'resume' })
    } else {
      postCommand({ type: 'start', durationMs })
    }
  },

  pause: () => {
    if (get().status !== 'running') return
    postCommand({ type: 'pause' })
  },

  resume: () => {
    if (get().status !== 'paused') return
    postCommand({ type: 'resume' })
  },

  reset: () => {
    ensureWorker(set, get)
    const durationMs = minutesToMs(get().durationMinutes)
    postCommand({ type: 'reset', durationMs })
  },
}))

export function formatPomodoroRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function formatPomodoroDurationMinutes(
  minutes: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const clamped = clampMinutes(minutes)
  if (clamped >= 60) {
    const h = Math.floor(clamped / 60)
    const m = clamped % 60
    if (m === 0) return t('pomodoro.durationHours', { h })
    return t('pomodoro.durationHoursMinutes', { h, m })
  }
  return t('pomodoro.durationMinutes', { m: clamped })
}
