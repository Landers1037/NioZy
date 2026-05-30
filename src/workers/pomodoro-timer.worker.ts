import type { PomodoroWorkerCommand, PomodoroWorkerEvent } from '@/lib/pomodoro-timer-types'

let intervalId: ReturnType<typeof setInterval> | null = null
let endTime = 0
let totalMs = 0
let remainingMs = 0
let running = false

function stopInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function post(event: PomodoroWorkerEvent) {
  self.postMessage(event)
}

function tick() {
  remainingMs = Math.max(0, endTime - Date.now())
  if (remainingMs <= 0) {
    stopInterval()
    running = false
    post({ type: 'complete', totalMs })
    return
  }
  post({ type: 'tick', remainingMs, totalMs })
}

function start(durationMs: number) {
  stopInterval()
  totalMs = durationMs
  remainingMs = durationMs
  endTime = Date.now() + durationMs
  running = true
  tick()
  intervalId = setInterval(tick, 250)
}

function pause() {
  if (!running) return
  stopInterval()
  remainingMs = Math.max(0, endTime - Date.now())
  running = false
  post({ type: 'paused', remainingMs, totalMs })
}

function resume() {
  if (running) return
  if (remainingMs <= 0) {
    post({ type: 'complete', totalMs })
    return
  }
  endTime = Date.now() + remainingMs
  running = true
  tick()
  intervalId = setInterval(tick, 250)
}

function reset(durationMs: number) {
  stopInterval()
  running = false
  totalMs = durationMs
  remainingMs = durationMs
  endTime = 0
  post({ type: 'idle', durationMs })
}

self.onmessage = (event: MessageEvent<PomodoroWorkerCommand>) => {
  const cmd = event.data
  switch (cmd.type) {
    case 'start':
      start(cmd.durationMs)
      break
    case 'pause':
      pause()
      break
    case 'resume':
      resume()
      break
    case 'reset':
      reset(cmd.durationMs)
      break
    case 'set-duration':
      if (!running) {
        totalMs = cmd.durationMs
        remainingMs = cmd.durationMs
        post({ type: 'idle', durationMs: cmd.durationMs })
      }
      break
    default:
      break
  }
}
