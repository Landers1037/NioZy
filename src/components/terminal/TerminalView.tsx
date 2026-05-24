import { useEffect, useRef, useCallback, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { WebglAddon } from '@xterm/addon-webgl'
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
import { handleTerminalTabNavigationShortcut } from '@/lib/app-shortcut-actions'
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
import {
  isLayoutResizing,
  registerLayoutFitOnResizeEnd,
} from '@/lib/layout-resize'
import {
  hasWebglSlot,
  registerWebglEvictHandler,
  releaseWebglSlot,
  touchWebglSlot,
  tryAcquireWebglSlot,
} from '@/lib/terminal-webgl-registry'
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
  /** WebGL 上下文丢失或加载失败后，本会话内不再尝试 WebGL */
  const webglBlockedRef = useRef(false)
  const lastFitRef = useRef({ cols: 0, rows: 0, width: 0, height: 0 })
  const [termReady, setTermReady] = useState(false)
  const settings = useAppStore((s) => s.settings)
  const rendererPreference = settings?.terminal.renderer ?? 'webgl'

  const safeFit = useCallback(
    (force = false): boolean => {
      const el = containerRef.current
      const fit = fitRef.current
      const term = termRef.current
      if (!el || !fit || !term || !hasLayout(el)) return false

      const width = el.clientWidth
      const height = el.clientHeight
      const prev = lastFitRef.current
      const sizeUnchanged = prev.width === width && prev.height === height

      if (!force && sizeUnchanged && term.cols === prev.cols && term.rows === prev.rows) {
        return term.cols > 0 && term.rows > 0
      }

      try {
        fit.fit()
        const { cols, rows } = term
        lastFitRef.current = { cols, rows, width, height }
        if (cols > 0 && rows > 0 && tab.terminalId) {
          if (force || cols !== prev.cols || rows !== prev.rows) {
            getElectronAPI().terminal.resize(tab.terminalId, cols, rows)
          }
        }
        return cols > 0 && rows > 0
      } catch {
        return false
      }
    },
    [tab.terminalId],
  )

  const scheduleFit = useCallback(
    (force = false) => {
      let attempts = 0
      const tryFit = () => {
        if (safeFit(force) || attempts >= 12) return
        attempts += 1
        requestAnimationFrame(tryFit)
      }
      requestAnimationFrame(tryFit)
    },
    [safeFit],
  )

  const disposeWebgl = useCallback(() => {
    const webgl = webglRef.current
    webglRef.current = null
    if (!webgl) return
    try {
      webgl.dispose()
    } catch {
      /* WebGL 上下文已丢失时 dispose 可能报错 */
    }
    if (tab.terminalId && hasWebglSlot(tab.terminalId)) {
      releaseWebglSlot(tab.terminalId)
    }
  }, [tab.terminalId])

  const loadWebgl = useCallback(async () => {
    if (!termRef.current || !tab.terminalId || webglRef.current) return
    if (preferDomRenderer || webglBlockedRef.current || rendererPreference !== 'webgl') return

    if (!tryAcquireWebglSlot(tab.terminalId)) return

    try {
      const { WebglAddon } = await import('@xterm/addon-webgl')
      if (!termRef.current || webglRef.current) {
        if (tab.terminalId && hasWebglSlot(tab.terminalId)) {
          releaseWebglSlot(tab.terminalId)
        }
        return
      }

      const webgl = new WebglAddon()
      webglRef.current = webgl
      termRef.current.loadAddon(webgl)
      touchWebglSlot(tab.terminalId)
      webgl.onContextLoss(() => {
        webglBlockedRef.current = true
        disposeWebgl()
        scheduleFit(true)
      })
      const shellAfterWebgl =
        useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
      applyTerminalShellAddons(termRef.current, shellAddonsRef.current, shellAfterWebgl)
      scheduleFit(true)
    } catch {
      webglBlockedRef.current = true
      disposeWebgl()
    }
  }, [tab.terminalId, preferDomRenderer, rendererPreference, disposeWebgl, scheduleFit])

  useEffect(() => {
    if (!tab.terminalId || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined
    let unsubLayoutFit: (() => void) | undefined
    let termElement: HTMLElement | undefined
    let onLeftMouseDown: ((e: MouseEvent) => void) | undefined
    let onRightMouseDown: ((e: MouseEvent) => void) | undefined
    let onContextMenu: ((e: MouseEvent) => void) | undefined
    const captureOpts = { capture: true } as const

    void (async () => {
      await import('@xterm/xterm/css/xterm.css')
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ])

      if (disposed || !containerRef.current) return

      const s = useAppStore.getState().settings
      const theme = resolveTerminalTheme(s?.terminal.colorScheme ?? 'atom')
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

      const api = getElectronAPI()
      const onData = (data: string) => {
        api.terminal.write(tab.terminalId!, data)
      }
      term.onData(onData)

      term.attachCustomKeyEventHandler((event) => {
        if (!tab.terminalId) return true
        if (handleTerminalTabNavigationShortcut(event)) return false

        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        if (handleTerminalModifiedEnterKey(tab.terminalId, event, shell.shiftEnterNewline)) {
          return false
        }

        const shortcuts = useAppStore.getState().settings?.shortcuts.app
        if (!shortcuts) return true
        const handled = handleTerminalKeyboardShortcut(term, tab.terminalId, shortcuts, event)
        return !handled
      })

      termElement = term.element ?? undefined

      const isRightClickCopyPasteEnabled = () => {
        const terminalSettings = useAppStore.getState().settings?.terminal
        return (
          !!tab.terminalId &&
          !!terminalSettings &&
          normalizeRightClickCopyPaste(terminalSettings.rightClickCopyPaste)
        )
      }

      onLeftMouseDown = (e: MouseEvent) => {
        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        handleInteractiveCliMouseDown(term, e, shell.shiftEnterNewline)
      }

      onRightMouseDown = (e: MouseEvent) => {
        if (e.button !== 2 || !isRightClickCopyPasteEnabled()) return
        handleTerminalRightClick(term, tab.terminalId!, e)
      }

      onContextMenu = (e: MouseEvent) => {
        if (!isRightClickCopyPasteEnabled()) return
        e.preventDefault()
        e.stopPropagation()
      }

      termElement?.addEventListener('mousedown', onLeftMouseDown, captureOpts)
      termElement?.addEventListener('mousedown', onRightMouseDown, captureOpts)
      termElement?.addEventListener('contextmenu', onContextMenu, captureOpts)

      ro = new ResizeObserver(() => {
        if (isLayoutResizing()) return
        scheduleFit()
      })
      ro.observe(containerRef.current)

      unsubLayoutFit = registerLayoutFitOnResizeEnd(() => {
        scheduleFit()
      })

      unsubData = api.terminal.onData((id, data) => {
        if (id === tab.terminalId) term.write(data)
      })

      unsubExit = api.terminal.onExit((id) => {
        if (id === tab.terminalId) {
          const msg = i18n.t('terminal.processExited')
          term.write(`\r\n\x1b[33m${msg}\x1b[0m\r\n`)
        }
      })

      scheduleFit(true)
      setTermReady(true)
    })()

    return () => {
      disposed = true
      setTermReady(false)
      webglBlockedRef.current = false
      lastFitRef.current = { cols: 0, rows: 0, width: 0, height: 0 }
      disposeWebgl()
      if (termElement && onLeftMouseDown && onRightMouseDown && onContextMenu) {
        termElement.removeEventListener('mousedown', onLeftMouseDown, captureOpts)
        termElement.removeEventListener('mousedown', onRightMouseDown, captureOpts)
        termElement.removeEventListener('contextmenu', onContextMenu, captureOpts)
      }
      unsubData?.()
      unsubExit?.()
      unsubLayoutFit?.()
      ro?.disconnect()
      if (tab.terminalId) {
        unregisterTerminal(tab.terminalId)
      }
      shellAddonsRef.current = createTerminalShellAddonState()
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [tab.terminalId, scheduleFit, disposeWebgl])

  useEffect(() => {
    if (!termReady || !tab.terminalId) return

    const unregisterEvict = registerWebglEvictHandler(tab.terminalId, () => {
      disposeWebgl()
    })

    void loadWebgl()

    return () => {
      unregisterEvict()
    }
  }, [termReady, tab.terminalId, loadWebgl, disposeWebgl])

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
    if (!termRef.current || !termReady) return
    if (rendererPreference !== 'webgl') {
      webglBlockedRef.current = false
      disposeWebgl()
      return
    }
    void loadWebgl()
  }, [rendererPreference, termReady, disposeWebgl, loadWebgl])

  useEffect(() => {
    if (!termRef.current || !tab.terminalId) return
    if (isFocused) {
      touchWebglSlot(tab.terminalId)
      safeFit()
      termRef.current.focus()
      if (!webglRef.current && !webglBlockedRef.current && rendererPreference === 'webgl') {
        void loadWebgl()
      }
      return
    }
    termRef.current.blur()
  }, [isFocused, safeFit, tab.terminalId, loadWebgl, rendererPreference])

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
