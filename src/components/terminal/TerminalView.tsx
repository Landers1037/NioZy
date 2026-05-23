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
  applyInteractiveCliTerminalOptions,
  handleInteractiveCliMouseDown,
} from '@/lib/terminal-interactive-cli'
import {
  handleTerminalKeyboardShortcut,
  handleTerminalModifiedEnterKey,
  handleTerminalRightClick,
} from '@/lib/terminal-shortcut-actions'
import {
  applyTerminalRuntimeOptions,
  buildTerminalOptions,
} from '@/lib/terminal-xterm-options'
import {
  applyTerminalShellAddons,
  createTerminalShellAddonState,
} from '@/lib/terminal-shell-addons'
import { DEFAULT_SHELL_SETTINGS } from '../../../electron/shared/shell-settings'
import { normalizeRightClickCopyPaste } from '../../../electron/shared/terminal-xterm'
import i18n from '@/lib/i18n'

interface TerminalViewProps {
  tab: AppTab
  /** 拆分多 pane 时用 DOM 渲染，避免多 WebGL 上下文 dispose 冲突 */
  preferDomRenderer?: boolean
  /** 当前 Tab / pane 处于前台时 refit 并聚焦 */
  isFocused?: boolean
}

function hasLayout(el: HTMLElement): boolean {
  return el.clientWidth >= 2 && el.clientHeight >= 2
}

export function TerminalView({ tab, preferDomRenderer = false, isFocused = false }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const webglRef = useRef<WebglAddon | null>(null)
  const shellAddonsRef = useRef(createTerminalShellAddonState())
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

    let disposed = false
    let webglFrame = 0

    const s = useAppStore.getState().settings
    const theme = resolveTerminalTheme(s?.terminal.colorScheme ?? 'atom')
    const useWebgl =
      !preferDomRenderer && (s?.terminal.renderer ?? 'webgl') === 'webgl'

    const shellSettings = s?.shell ?? DEFAULT_SHELL_SETTINGS
    const term = new Terminal(
      buildTerminalOptions(
        s?.terminal,
        theme,
        getTerminalCursorOptions(s?.terminal),
        shellSettings.emojiNativeRendering,
      ),
    )

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    applyInteractiveCliTerminalOptions(term, shellSettings.shiftEnterNewline)

    termRef.current = term
    fitRef.current = fit
    registerTerminal(tab.terminalId!, term)

    applyTerminalShellAddons(term, shellAddonsRef.current, shellSettings)

    const loadWebgl = () => {
      if (disposed || !termRef.current) return
      const prev = webglRef.current
      webglRef.current = null
      if (prev) {
        try {
          prev.dispose()
        } catch {
          /* WebGL 上下文已丢失时 delete 会报 INVALID_OPERATION */
        }
      }
      try {
        const webgl = new WebglAddon()
        webglRef.current = webgl
        term.loadAddon(webgl)
        webgl.onContextLoss(() => {
          if (disposed) return
          webglFrame = requestAnimationFrame(loadWebgl)
        })
        const shellAfterWebgl = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        applyTerminalShellAddons(term, shellAddonsRef.current, shellAfterWebgl)
        scheduleFit()
      } catch {
        webglRef.current = null
      }
    }

    const api = getElectronAPI()
    const onData = (data: string) => {
      api.terminal.write(tab.terminalId!, data)
    }
    term.onData(onData)

    term.attachCustomKeyEventHandler((event) => {
      if (!tab.terminalId) return true
      const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
      if (handleTerminalModifiedEnterKey(tab.terminalId, event, shell.shiftEnterNewline)) {
        return false
      }

      const shortcuts = useAppStore.getState().settings?.shortcuts.app
      if (!shortcuts) return true
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

    const onLeftMouseDown = (e: MouseEvent) => {
      const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
      handleInteractiveCliMouseDown(term, e, shell.shiftEnterNewline)
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

    termElement?.addEventListener('mousedown', onLeftMouseDown, captureOpts)
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

    scheduleFit()

    if (useWebgl) {
      webglFrame = requestAnimationFrame(() => {
        if (!safeFit()) {
          webglFrame = requestAnimationFrame(loadWebgl)
          return
        }
        loadWebgl()
      })
    }

    return () => {
      disposed = true
      cancelAnimationFrame(webglFrame)
      termElement?.removeEventListener('mousedown', onLeftMouseDown, captureOpts)
      termElement?.removeEventListener('mousedown', onRightMouseDown, captureOpts)
      termElement?.removeEventListener('contextmenu', onContextMenu, captureOpts)
      unsubData()
      unsubExit()
      ro.disconnect()
      unregisterTerminal(tab.terminalId!)
      shellAddonsRef.current = createTerminalShellAddonState()
      webglRef.current = null
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [tab.terminalId, scheduleFit, safeFit, preferDomRenderer])

  useEffect(() => {
    if (!termRef.current || !settings) return
    const shell = settings.shell ?? DEFAULT_SHELL_SETTINGS
    applyInteractiveCliTerminalOptions(termRef.current, shell.shiftEnterNewline)
    applyTerminalShellAddons(termRef.current, shellAddonsRef.current, shell)
  }, [settings?.shell])

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

  useEffect(() => {
    if (!termRef.current) return
    if (isFocused) {
      scheduleFit()
      termRef.current.focus()
      return
    }
    termRef.current.blur()
  }, [isFocused, scheduleFit])

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
