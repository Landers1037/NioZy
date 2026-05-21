import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useAppStore } from '@/stores/app-store'
import { resolveTerminalTheme } from '@/lib/terminal-themes'
import type { AppTab } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'

interface TerminalViewProps {
  tab: AppTab
  visible: boolean
}

function hasLayout(el: HTMLElement): boolean {
  return el.clientWidth >= 2 && el.clientHeight >= 2
}

export function TerminalView({ tab, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const visibleRef = useRef(visible)
  const settings = useAppStore((s) => s.settings)

  visibleRef.current = visible

  const safeFit = useCallback((): boolean => {
    const el = containerRef.current
    const fit = fitRef.current
    const term = termRef.current
    if (!el || !fit || !term || !visibleRef.current || !hasLayout(el)) return false

    try {
      fit.fit()
      const { cols, rows } = term
      if (cols > 0 && rows > 0 && tab.terminalId) {
        getElectronAPI().terminal.resize(tab.terminalId, cols, rows)
      }
      return cols > 0 && rows > 0
    } catch {
      return false
    }
  }, [tab.terminalId])

  const scheduleFit = useCallback(() => {
    let attempts = 0
    const tryFit = () => {
      if (safeFit() || attempts >= 12) return
      attempts += 1
      requestAnimationFrame(tryFit)
    }
    requestAnimationFrame(tryFit)
  }, [safeFit])

  useEffect(() => {
    if (!tab.terminalId || termRef.current || !containerRef.current) return

    const s = useAppStore.getState().settings
    const theme = resolveTerminalTheme(s?.terminal.colorScheme ?? 'atom')

    const term = new Terminal({
      fontFamily: s?.terminal.fontFamily ?? 'Consolas',
      fontSize: s?.terminal.fontSize ?? 13,
      theme,
      cursorBlink: true,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    termRef.current = term
    fitRef.current = fit

    const api = getElectronAPI()
    const onData = (data: string) => {
      api.terminal.write(tab.terminalId!, data)
    }
    term.onData(onData)

    const ro = new ResizeObserver(() => {
      if (visibleRef.current) scheduleFit()
    })
    ro.observe(containerRef.current)

    const unsubData = api.terminal.onData((id, data) => {
      if (id === tab.terminalId) term.write(data)
    })

    const unsubExit = api.terminal.onExit((id) => {
      if (id === tab.terminalId) term.write('\r\n\x1b[33m[进程已退出]\x1b[0m\r\n')
    })

    scheduleFit()

    const renderer = s?.terminal.renderer ?? 'webgl'
    if (renderer === 'webgl') {
      requestAnimationFrame(() => {
        if (!termRef.current || !safeFit()) return
        try {
          const webgl = new WebglAddon()
          term.loadAddon(webgl)
          webgl.onContextLoss(() => {
            webgl.dispose()
            scheduleFit()
          })
          scheduleFit()
        } catch {
          /* DOM 渲染回退 */
        }
      })
    }

    return () => {
      unsubData()
      unsubExit()
      ro.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [tab.terminalId, scheduleFit, safeFit])

  useEffect(() => {
    if (visible) scheduleFit()
  }, [visible, scheduleFit])

  useEffect(() => {
    if (!termRef.current || !settings) return
    termRef.current.options.theme = resolveTerminalTheme(settings.terminal.colorScheme)
    termRef.current.options.fontFamily = settings.terminal.fontFamily
    termRef.current.options.fontSize = settings.terminal.fontSize
    if (visibleRef.current) scheduleFit()
  }, [settings?.terminal, scheduleFit])

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute inset-0 overflow-hidden rounded-lg bg-[#101419] p-1',
        visible ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none',
      )}
      aria-hidden={!visible}
    />
  )
}
