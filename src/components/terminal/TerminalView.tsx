import { useEffect, useRef, useCallback, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { CanvasAddon } from '@xterm/addon-canvas'
import type { WebglAddon } from '@xterm/addon-webgl'
import { useAppStore } from '@/stores/app-store'
import { resolveTerminalTheme } from '@/lib/terminal-themes'
import type { TerminalViewProps } from './terminal-view-props'
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
import type { TerminalRenderer } from '../../../electron/shared/api-types'
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
import { observeTerminalInputA11y } from '@/lib/terminal-input-a11y'
import {
  formatTerminalExitMessage,
  markSshTerminalDisconnected,
  tryHandleSshReconnectEnter,
} from '@/lib/ssh-reconnect-actions'
import { SshReconnectHint } from '@/components/terminal/SshReconnectHint'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { getTerminalBufferText } from '@/lib/terminal-buffer'
import {
  useAttachPtySessionStore,
  type AttachPtyCommittedSession,
} from '@/stores/attach-pty-session-store'

function hasLayout(el: HTMLElement): boolean {
  return el.clientWidth >= 2 && el.clientHeight >= 2
}

function effectiveRenderer(
  preference: TerminalRenderer,
  preferDomRenderer: boolean,
): TerminalRenderer {
  return preferDomRenderer ? 'dom' : preference
}

export function TerminalView({
  tab,
  preferDomRenderer = false,
  isFocused = false,
  attachSession = undefined,
}: TerminalViewProps) {
  const isAttachHost = attachSession !== undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const tabRef = useRef(tab)
  const boundTerminalIdRef = useRef<string | null>(
    isAttachHost ? (attachSession?.terminalId ?? null) : (tab.terminalId ?? null),
  )
  const prevAttachSessionRef = useRef<AttachPtyCommittedSession | null>(
    attachSession ?? null,
  )
  const fitRef = useRef<FitAddon | null>(null)
  const canvasRef = useRef<CanvasAddon | null>(null)
  const webglRef = useRef<WebglAddon | null>(null)
  const shellAddonsRef = useRef(createTerminalShellAddonState())
  /** WebGL 上下文丢失或加载失败后，本会话内不再尝试 WebGL */
  const webglBlockedRef = useRef(false)
  const lastFitRef = useRef({ cols: 0, rows: 0, width: 0, height: 0 })
  const [termReady, setTermReady] = useState(false)
  const settings = useAppStore((s) => s.settings)

  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  useEffect(() => {
    if (isAttachHost) {
      boundTerminalIdRef.current = attachSession?.terminalId ?? null
    } else {
      boundTerminalIdRef.current = tab.terminalId ?? null
    }
  }, [isAttachHost, attachSession?.terminalId, tab.terminalId])

  const effectiveTerminalId = isAttachHost
    ? (attachSession?.terminalId ?? null)
    : (tab.terminalId ?? null)
  const rendererPreference = settings?.terminal.renderer ?? 'webgl'
  const superPowerSavingDom =
    settings?.performance.superPowerSaving === true &&
    settings.experimental?.terminalEmulator !== 'wterm'
  const activeRenderer = effectiveRenderer(
    rendererPreference,
    preferDomRenderer || superPowerSavingDom,
  )

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
        const terminalId = boundTerminalIdRef.current
        if (cols > 0 && rows > 0 && terminalId) {
          if (force || cols !== prev.cols || rows !== prev.rows) {
            getElectronAPI().terminal.resize(terminalId, cols, rows)
          }
        }
        return cols > 0 && rows > 0
      } catch {
        return false
      }
    },
    [],
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

  const disposeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    canvasRef.current = null
    if (!canvas) return
    try {
      canvas.dispose()
    } catch {
      /* addon 已卸载时 dispose 可能报错 */
    }
  }, [])

  const disposeWebgl = useCallback(() => {
    const webgl = webglRef.current
    webglRef.current = null
    if (!webgl) return
    try {
      webgl.dispose()
    } catch {
      /* WebGL 上下文已丢失时 dispose 可能报错 */
    }
    const terminalId = boundTerminalIdRef.current
    if (terminalId && hasWebglSlot(terminalId)) {
      releaseWebglSlot(terminalId)
    }
  }, [])

  const loadCanvas = useCallback(async () => {
    if (!termRef.current || canvasRef.current || activeRenderer !== 'canvas') return

    try {
      const { CanvasAddon } = await import('@xterm/addon-canvas')
      if (!termRef.current || canvasRef.current || activeRenderer !== 'canvas') return

      const canvas = new CanvasAddon()
      canvasRef.current = canvas
      termRef.current.loadAddon(canvas)
      const shellAfterCanvas =
        useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
      applyTerminalShellAddons(termRef.current, shellAddonsRef.current, shellAfterCanvas)
      scheduleFit(true)
    } catch {
      disposeCanvas()
    }
  }, [activeRenderer, disposeCanvas, scheduleFit])

  const loadWebgl = useCallback(async () => {
    const terminalId = boundTerminalIdRef.current
    if (!termRef.current || !terminalId || webglRef.current) return
    if (webglBlockedRef.current || activeRenderer !== 'webgl') return

    if (!tryAcquireWebglSlot(terminalId)) return

    try {
      const { WebglAddon } = await import('@xterm/addon-webgl')
      if (!termRef.current || webglRef.current) {
        if (terminalId && hasWebglSlot(terminalId)) {
          releaseWebglSlot(terminalId)
        }
        return
      }

      const webgl = new WebglAddon()
      webglRef.current = webgl
      termRef.current.loadAddon(webgl)
      touchWebglSlot(terminalId)
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
  }, [activeRenderer, disposeWebgl, scheduleFit])

  const applyRenderer = useCallback(() => {
    if (!termRef.current || !termReady) return

    if (activeRenderer === 'dom') {
      disposeCanvas()
      disposeWebgl()
      return
    }
    if (activeRenderer === 'canvas') {
      disposeWebgl()
      if (!canvasRef.current) void loadCanvas()
      return
    }
    if (activeRenderer === 'webgl') {
      disposeCanvas()
      if (!webglRef.current && !webglBlockedRef.current) void loadWebgl()
    }
  }, [activeRenderer, termReady, disposeCanvas, disposeWebgl, loadCanvas, loadWebgl])

  const detachAttachSession = useCallback(() => {
    const term = termRef.current
    const prev = prevAttachSessionRef.current
    if (!term || !prev) return
    useAttachPtySessionStore.getState().saveSnapshot(prev.tabId, getTerminalBufferText(term))
    unregisterTerminal(prev.terminalId)
    prevAttachSessionRef.current = null
    boundTerminalIdRef.current = null
  }, [])

  const applyAttachSession = useCallback(
    (session: AttachPtyCommittedSession | null) => {
      const term = termRef.current
      if (!term) return

      detachAttachSession()

      if (!session) {
        term.clear()
        return
      }

      prevAttachSessionRef.current = session
      boundTerminalIdRef.current = session.terminalId
      registerTerminal(session.terminalId, term)
      term.clear()
      const snap = useAttachPtySessionStore.getState().takeSnapshot(session.tabId)
      if (snap?.bufferText) {
        term.write(snap.bufferText)
      }
      scheduleFit(true)
      term.focus()
    },
    [detachAttachSession, scheduleFit],
  )

  useEffect(() => {
    if (isAttachHost) return
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
    let stopInputA11y: (() => void) | undefined
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
      stopInputA11y = observeTerminalInputA11y(
        containerRef.current,
        i18n.t('terminal.inputAriaLabel'),
      )
      applyInteractiveCliTerminalOptions(term, shellSettings.shiftEnterNewline)

      termRef.current = term
      fitRef.current = fit
      registerTerminal(tab.terminalId!, term)
      boundTerminalIdRef.current = tab.terminalId!

      const snap = useAttachPtySessionStore.getState().takeSnapshot(tab.id)
      if (snap?.bufferText) {
        term.write(snap.bufferText)
      }

      applyTerminalShellAddons(term, shellAddonsRef.current, shellSettings)

      const api = getElectronAPI()
      const onData = (data: string) => {
        const terminalId = boundTerminalIdRef.current
        if (!terminalId) return
        touchTabActivity(tabRef.current.id)
        api.terminal.write(terminalId, data)
      }
      term.onData(onData)

      term.attachCustomKeyEventHandler((event) => {
        const currentTab = tabRef.current
        const terminalId = boundTerminalIdRef.current
        if (!terminalId) return true
        if (handleTerminalTabNavigationShortcut(event)) return false

        if (tryHandleSshReconnectEnter(currentTab, terminalId, event)) {
          return false
        }

        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        if (handleTerminalModifiedEnterKey(terminalId, event, shell.shiftEnterNewline)) {
          return false
        }

        const shortcuts = useAppStore.getState().settings?.shortcuts.app
        if (!shortcuts) return true
        const handled = handleTerminalKeyboardShortcut(term, terminalId, shortcuts, event)
        return !handled
      })

      termElement = term.element ?? undefined

      const isRightClickCopyPasteEnabled = () => {
        const terminalSettings = useAppStore.getState().settings?.terminal
        return (
          !!boundTerminalIdRef.current &&
          !!terminalSettings &&
          normalizeRightClickCopyPaste(terminalSettings.rightClickCopyPaste)
        )
      }

      onLeftMouseDown = (e: MouseEvent) => {
        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        handleInteractiveCliMouseDown(term, e, shell.shiftEnterNewline)
      }

      onRightMouseDown = (e: MouseEvent) => {
        const terminalId = boundTerminalIdRef.current
        if (e.button !== 2 || !terminalId || !isRightClickCopyPasteEnabled()) return
        handleTerminalRightClick(term, terminalId, e)
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
        if (id === boundTerminalIdRef.current) term.write(data)
      })

      unsubExit = api.terminal.onExit((id, code) => {
        if (id === boundTerminalIdRef.current) {
          term.write(formatTerminalExitMessage(code))
          markSshTerminalDisconnected(id, tabRef.current)
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
      disposeCanvas()
      disposeWebgl()
      if (termElement && onLeftMouseDown && onRightMouseDown && onContextMenu) {
        termElement.removeEventListener('mousedown', onLeftMouseDown, captureOpts)
        termElement.removeEventListener('mousedown', onRightMouseDown, captureOpts)
        termElement.removeEventListener('contextmenu', onContextMenu, captureOpts)
      }
      stopInputA11y?.()
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
  }, [tab.terminalId, scheduleFit, disposeCanvas, disposeWebgl, isAttachHost])

  useEffect(() => {
    if (!isAttachHost || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined
    let unsubLayoutFit: (() => void) | undefined
    let termElement: HTMLElement | undefined
    let onLeftMouseDown: ((e: MouseEvent) => void) | undefined
    let onRightMouseDown: ((e: MouseEvent) => void) | undefined
    let onContextMenu: ((e: MouseEvent) => void) | undefined
    let stopInputA11y: (() => void) | undefined
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
      stopInputA11y = observeTerminalInputA11y(
        containerRef.current,
        i18n.t('terminal.inputAriaLabel'),
      )
      applyInteractiveCliTerminalOptions(term, shellSettings.shiftEnterNewline)

      termRef.current = term
      fitRef.current = fit

      applyTerminalShellAddons(term, shellAddonsRef.current, shellSettings)

      const api = getElectronAPI()
      const onData = (data: string) => {
        const terminalId = boundTerminalIdRef.current
        if (!terminalId) return
        touchTabActivity(tabRef.current.id)
        api.terminal.write(terminalId, data)
      }
      term.onData(onData)

      term.attachCustomKeyEventHandler((event) => {
        const currentTab = tabRef.current
        const terminalId = boundTerminalIdRef.current
        if (!terminalId) return true
        if (handleTerminalTabNavigationShortcut(event)) return false

        if (tryHandleSshReconnectEnter(currentTab, terminalId, event)) {
          return false
        }

        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        if (handleTerminalModifiedEnterKey(terminalId, event, shell.shiftEnterNewline)) {
          return false
        }

        const shortcuts = useAppStore.getState().settings?.shortcuts.app
        if (!shortcuts) return true
        const handled = handleTerminalKeyboardShortcut(term, terminalId, shortcuts, event)
        return !handled
      })

      termElement = term.element ?? undefined

      const isRightClickCopyPasteEnabled = () => {
        const terminalSettings = useAppStore.getState().settings?.terminal
        return (
          !!boundTerminalIdRef.current &&
          !!terminalSettings &&
          normalizeRightClickCopyPaste(terminalSettings.rightClickCopyPaste)
        )
      }

      onLeftMouseDown = (e: MouseEvent) => {
        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        handleInteractiveCliMouseDown(term, e, shell.shiftEnterNewline)
      }

      onRightMouseDown = (e: MouseEvent) => {
        const terminalId = boundTerminalIdRef.current
        if (e.button !== 2 || !terminalId || !isRightClickCopyPasteEnabled()) return
        handleTerminalRightClick(term, terminalId, e)
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
        if (id === boundTerminalIdRef.current) term.write(data)
      })

      unsubExit = api.terminal.onExit((id, code) => {
        if (id === boundTerminalIdRef.current) {
          term.write(formatTerminalExitMessage(code))
          markSshTerminalDisconnected(id, tabRef.current)
        }
      })

      scheduleFit(true)
      setTermReady(true)
    })()

    return () => {
      disposed = true
      setTermReady(false)
      detachAttachSession()
      webglBlockedRef.current = false
      lastFitRef.current = { cols: 0, rows: 0, width: 0, height: 0 }
      disposeCanvas()
      disposeWebgl()
      if (termElement && onLeftMouseDown && onRightMouseDown && onContextMenu) {
        termElement.removeEventListener('mousedown', onLeftMouseDown, captureOpts)
        termElement.removeEventListener('mousedown', onRightMouseDown, captureOpts)
        termElement.removeEventListener('contextmenu', onContextMenu, captureOpts)
      }
      stopInputA11y?.()
      unsubData?.()
      unsubExit?.()
      unsubLayoutFit?.()
      ro?.disconnect()
      shellAddonsRef.current = createTerminalShellAddonState()
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [isAttachHost, scheduleFit, disposeCanvas, disposeWebgl, detachAttachSession])

  useEffect(() => {
    if (!isAttachHost || !termReady) return
    const session = attachSession ?? null
    const prev = prevAttachSessionRef.current
    if (
      session?.terminalId === prev?.terminalId &&
      session?.tabId === prev?.tabId
    ) {
      return
    }
    applyAttachSession(session)
  }, [
    isAttachHost,
    termReady,
    attachSession?.tabId,
    attachSession?.terminalId,
    applyAttachSession,
  ])

  useEffect(() => {
    if (!termReady || !effectiveTerminalId || activeRenderer !== 'webgl') return

    const unregisterEvict = registerWebglEvictHandler(effectiveTerminalId, () => {
      disposeWebgl()
    })

    void loadWebgl()

    return () => {
      unregisterEvict()
    }
  }, [termReady, effectiveTerminalId, activeRenderer, loadWebgl, disposeWebgl])

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
    if (!termReady) return
    if (activeRenderer !== 'webgl') {
      webglBlockedRef.current = false
    }
    applyRenderer()
  }, [activeRenderer, termReady, applyRenderer])

  useEffect(() => {
    if (!termRef.current || !effectiveTerminalId) return
    if (isFocused) {
      touchTabActivity(tab.id)
      if (activeRenderer === 'webgl') {
        touchWebglSlot(effectiveTerminalId)
      }
      safeFit()
      termRef.current.focus()
      if (
        activeRenderer === 'webgl' &&
        !webglRef.current &&
        !webglBlockedRef.current
      ) {
        void loadWebgl()
      } else if (activeRenderer === 'canvas' && !canvasRef.current) {
        void loadCanvas()
      }
      return
    }
    termRef.current.blur()
  }, [isFocused, safeFit, effectiveTerminalId, loadWebgl, loadCanvas, activeRenderer, tab.id])

  const terminalBackground =
    resolveTerminalTheme(settings?.terminal.colorScheme ?? 'atom').background ?? '#101419'

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: terminalBackground }}
    >
      <div ref={containerRef} className="niozy-terminal-host h-full w-full overflow-hidden" />
      <SshReconnectHint terminalId={effectiveTerminalId ?? undefined} />
    </div>
  )
}
