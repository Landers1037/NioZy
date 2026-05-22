import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useAppStore } from '@/stores/app-store'
import { resolveTerminalTheme } from '@/lib/terminal-themes'
import type { AppTab } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { registerTerminal, unregisterTerminal } from '@/lib/terminal-registry'
import { getTerminalCursorOptions } from '@/lib/terminal-cursor'
import {
  handleTerminalKeyboardShortcut,
  handleTerminalRightClick,
} from '@/lib/terminal-shortcut-actions'
import {
  applyTerminalRuntimeOptions,
  buildTerminalOptions,
} from '@/lib/terminal-xterm-options'
import { normalizeRightClickCopyPaste } from '../../../electron/shared/terminal-xterm'
import i18n from '@/lib/i18n'

interface TerminalViewProps {
  tab: AppTab
}

function hasLayout(el: HTMLElement): boolean {
  return el.clientWidth >= 2 && el.clientHeight >= 2
}

export function TerminalView({ tab }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const settings = useAppStore((s) => s.settings)

  const safeFit = useCallback((): boolean => {
    const el = containerRef.current
    const fit = fitRef.current
    const term = termRef.current
    if (!el || !fit || !term || !hasLayout(el)) return false

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

    const term = new Terminal(
      buildTerminalOptions(s?.terminal, theme, getTerminalCursorOptions(s?.terminal)),
    )

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    termRef.current = term
    fitRef.current = fit
    registerTerminal(tab.terminalId!, term)

    const api = getElectronAPI()
    const onData = (data: string) => {
      api.terminal.write(tab.terminalId!, data)
    }
    term.onData(onData)

    term.attachCustomKeyEventHandler((event) => {
      const shortcuts = useAppStore.getState().settings?.shortcuts.app
      if (!shortcuts || !tab.terminalId) return true
      const handled = handleTerminalKeyboardShortcut(term, tab.terminalId, shortcuts, event)
      return !handled
    })

    const captureOpts = { capture: true } as const
    const termElement = term.element

    const isRightClickCopyPasteEnabled = () => {
      const terminalSettings = useAppStore.getState().settings?.terminal
      return (
        !!tab.terminalId &&
        !!terminalSettings &&
        normalizeRightClickCopyPaste(terminalSettings.rightClickCopyPaste)
      )
    }

    const onRightMouseDown = (e: MouseEvent) => {
      if (e.button !== 2 || !isRightClickCopyPasteEnabled()) return
      handleTerminalRightClick(term, tab.terminalId!, e)
    }

    const onContextMenu = (e: MouseEvent) => {
      if (!isRightClickCopyPasteEnabled()) return
      e.preventDefault()
      e.stopPropagation()
    }

    termElement?.addEventListener('mousedown', onRightMouseDown, captureOpts)
    termElement?.addEventListener('contextmenu', onContextMenu, captureOpts)

    const ro = new ResizeObserver(() => {
      scheduleFit()
    })
    ro.observe(containerRef.current)

    const unsubData = api.terminal.onData((id, data) => {
      if (id === tab.terminalId) term.write(data)
    })

    const unsubExit = api.terminal.onExit((id) => {
      if (id === tab.terminalId) {
        const msg = i18n.t('terminal.processExited')
        term.write(`\r\n\x1b[33m${msg}\x1b[0m\r\n`)
      }
    })

    void api.terminal.setActiveStream(tab.terminalId!)
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
      void api.terminal.setActiveStream(null)
      termElement?.removeEventListener('mousedown', onRightMouseDown, captureOpts)
      termElement?.removeEventListener('contextmenu', onContextMenu, captureOpts)
      unsubData()
      unsubExit()
      ro.disconnect()
      unregisterTerminal(tab.terminalId!)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [tab.terminalId, scheduleFit, safeFit])

  useEffect(() => {
    if (!termRef.current || !settings) return
    const cursor = getTerminalCursorOptions(settings.terminal)
    termRef.current.options.theme = resolveTerminalTheme(settings.terminal.colorScheme)
    termRef.current.options.fontFamily = settings.terminal.fontFamily
    termRef.current.options.fontSize = settings.terminal.fontSize
    termRef.current.options.cursorBlink = cursor.cursorBlink
    termRef.current.options.cursorStyle = cursor.cursorStyle
    applyTerminalRuntimeOptions(termRef.current, settings.terminal)
    scheduleFit()
  }, [settings?.terminal, scheduleFit])

  const terminalBackground =
    resolveTerminalTheme(settings?.terminal.colorScheme ?? 'atom').background ?? '#101419'

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: terminalBackground }}
    >
      <div ref={containerRef} className="niozy-terminal-host h-full w-full overflow-hidden" />
    </div>
  )
}
