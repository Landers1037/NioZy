import { useCallback, useEffect, useRef, useState } from 'react'
import type { IDisposable, Terminal } from '@xterm/xterm'

export interface UseTerminalIdleAnimationOptions {
  enabled: boolean
  idleDelayMs: number
  getTerm: () => Terminal | null
  termReady: boolean
  isFocused?: boolean
}

type TerminalWithWriteParsed = Terminal & {
  onWriteParsed?: (listener: () => void) => IDisposable
}

export function useTerminalIdleAnimation({
  enabled,
  idleDelayMs,
  getTerm,
  termReady,
  isFocused = true,
}: UseTerminalIdleAnimationOptions) {
  const [active, setActive] = useState(false)
  const lastActivityRef = useRef(Date.now())

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    setActive(false)
  }, [])

  useEffect(() => {
    const term = getTerm()
    if (!enabled || !termReady || !term || !isFocused) {
      setActive(false)
      return
    }

    lastActivityRef.current = Date.now()
    setActive(false)

    const disposables: IDisposable[] = [
      term.onData(bumpActivity),
    ]

    // onWriteParsed fires very frequently during log floods;
    // throttle to at most once per 500ms to avoid React state churn
    let writeParsedThrottled = false
    const onWriteParsed = (term as TerminalWithWriteParsed).onWriteParsed
    if (onWriteParsed) {
      disposables.push(onWriteParsed.call(term, () => {
        if (writeParsedThrottled) return
        writeParsedThrottled = true
        setTimeout(() => { writeParsedThrottled = false }, 500)
        bumpActivity()
      }))
    }

    const el = term.element
    const onActivity = () => bumpActivity()
    el?.addEventListener('keydown', onActivity, true)
    el?.addEventListener('mousedown', onActivity, true)
    el?.addEventListener('wheel', onActivity, true)

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= idleDelayMs) {
        setActive(true)
      }
    }, 1000)

    return () => {
      for (const disposable of disposables) disposable.dispose()
      el?.removeEventListener('keydown', onActivity, true)
      el?.removeEventListener('mousedown', onActivity, true)
      el?.removeEventListener('wheel', onActivity, true)
      window.clearInterval(timer)
      setActive(false)
    }
  }, [enabled, idleDelayMs, getTerm, termReady, isFocused, bumpActivity])

  return { active, bumpActivity }
}
