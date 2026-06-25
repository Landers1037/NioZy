import { useCallback, useEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { registerTerminal, unregisterTerminal } from '@/lib/terminal-registry'
import { buildTerminalOptions, applyTerminalRuntimeOptions } from '@/lib/terminal-xterm-options'
import {
  getTerminalCellBackgroundColor,
  getTerminalChromeBackgroundColor,
  hasTerminalBackgroundImage,
  resolveTerminalThemeWithBackground,
} from '@/lib/terminal-background'
import { cn } from '@/lib/utils'
import { getTerminalCursorOptions } from '@/lib/terminal-cursor'
import { createMuxTerminalWriteBatcher } from '@/lib/mux-terminal-write-batcher'
import { muxTerminalLog } from '@/lib/mux-terminal-log'
import { applyInteractiveCliTerminalOptions } from '@/lib/terminal-interactive-cli'
import { attachTerminalCustomKeyHandler } from '@/lib/terminal-custom-key-handler'
import { DEFAULT_SHELL_SETTINGS } from '../../../electron/shared/shell-settings'
import { loadTerminalModules } from '@/lib/ghostty-web-loader'
import { waitForTerminalFonts } from '@/lib/terminal-webgl-refresh'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { notifyTerminalFocusReady } from '@/lib/terminal-focus'
import { isLayoutResizing, registerLayoutFitOnResizeEnd } from '@/lib/layout-resize'
import { computeMuxGridLayout, paneIndexAtCell, type MuxGridPaneCount } from '@/lib/mux-grid-layout'
import { getXtermCellFromMouseEvent } from '@/lib/mux-xterm-mouse'

interface MuxTerminalViewProps {
  tab: AppTab
  isFocused?: boolean
}

export function MuxTerminalView({ tab, isFocused = false }: MuxTerminalViewProps) {
  const sessionId = tab.terminalId
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const focusPaneRef = useRef(0)
  const paneCount = tab.muxPaneCount ?? 4
  const terminalSettings = useAppStore((s) => s.settings?.terminal)
  const [termReady, setTermReady] = useState(false)
  const terminalHasBackgroundImage = hasTerminalBackgroundImage(terminalSettings)
  const chromeBackground = terminalHasBackgroundImage
    ? getTerminalCellBackgroundColor(terminalSettings)
    : getTerminalChromeBackgroundColor(terminalSettings)

  const safeFit = useCallback(
    (force = false) => {
      const term = termRef.current
      const fit = fitRef.current
      const el = containerRef.current
      if (!term || !fit || !el || el.clientWidth < 2 || el.clientHeight < 2) return false
      if (isLayoutResizing() && !force) return false
      fit.fit()
      if (sessionId) {
        getElectronAPI().muxTerminal.resize(sessionId, term.cols, term.rows)
      }
      return true
    },
    [sessionId],
  )

  useEffect(() => {
    if (!sessionId || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubExit: (() => void) | undefined
    let writeBatcher: ReturnType<typeof createMuxTerminalWriteBatcher> | undefined
    let unsubLayoutFit: (() => void) | undefined
    let onMouseDown: ((event: MouseEvent) => void) | undefined
    const pendingChunks: string[] = []

    muxTerminalLog.info('mount effect start', { sessionId, tabId: tab.id })

    const unsubData = getElectronAPI().muxTerminal.onData((id, data) => {
      if (id !== sessionId || disposed) return
      if (writeBatcher) {
        writeBatcher.queue(data)
      } else {
        pendingChunks.push(data)
      }
    })

    void (async () => {
      const s = useAppStore.getState().settings
      const { Terminal, FitAddon } = await loadTerminalModules('xterm')
      if (disposed || !containerRef.current) return

      if (s?.terminal?.useBuiltinFont) {
        await waitForTerminalFonts(s.terminal)
      }
      if (disposed || !containerRef.current) return

      const theme = resolveTerminalThemeWithBackground(
        s?.terminal.colorScheme ?? 'atom',
        s?.terminal,
      )
      const termOptions = buildTerminalOptions(
        s?.terminal,
        theme,
        getTerminalCursorOptions(s?.terminal),
        s?.shell?.emojiNativeRendering,
      )
      const term = new Terminal(termOptions)
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(containerRef.current)
      termRef.current = term
      fitRef.current = fit
      registerTerminal(sessionId, term)
      applyTerminalRuntimeOptions(term, s?.terminal)
      applyInteractiveCliTerminalOptions(
        term,
        s?.shell?.shiftEnterNewline ?? DEFAULT_SHELL_SETTINGS.shiftEnterNewline,
      )

      writeBatcher = createMuxTerminalWriteBatcher(
        () => termRef.current,
        () => useAppStore.getState().settings,
      )

      for (const chunk of pendingChunks) {
        writeBatcher.queue(chunk)
      }
      pendingChunks.length = 0

      const replay = await getElectronAPI().muxTerminal.claimStream(sessionId)
      if (disposed) return
      if (replay) writeBatcher.queue(replay)

      const fitOk = safeFit(true)
      if (!disposed && !replay) {
        const retry = await getElectronAPI().muxTerminal.claimStream(sessionId)
        if (disposed) return
        if (retry) writeBatcher.queue(retry)
      }

      muxTerminalLog.info('claimStream done', {
        sessionId,
        replayBytes: replay.length,
        cols: term.cols,
        rows: term.rows,
      })
      muxTerminalLog.info('xterm opened', {
        sessionId,
        fitOk,
        cols: term.cols,
        rows: term.rows,
      })

      unsubExit = getElectronAPI().muxTerminal.onExit((id, code) => {
        if (id !== sessionId) return
        term.write(`\r\n\x1b[90m[Mux session exited: ${code}]\x1b[0m\r\n`)
      })

      attachTerminalCustomKeyHandler(term, 'xterm', {
        getTab: () => tab,
        getTerminalId: () => sessionId,
        term,
      })

      onMouseDown = (event: MouseEvent) => {
        if (paneCount <= 1 || event.button !== 0) return
        const coords = getXtermCellFromMouseEvent(term, event)
        if (!coords) return
        const layout = computeMuxGridLayout(
          term.cols,
          term.rows,
          paneCount as MuxGridPaneCount,
        )
        const paneIndex = paneIndexAtCell(layout, paneCount, coords.col, coords.row)
        if (paneIndex !== focusPaneRef.current) {
          focusPaneRef.current = paneIndex
          getElectronAPI().muxTerminal.setFocus(sessionId, paneIndex)
        }
        term.focus()
      }
      term.element?.addEventListener('mousedown', onMouseDown)

      term.onData((data) => {
        touchTabActivity(tab.id)
        getElectronAPI().muxTerminal.write(sessionId, data, focusPaneRef.current)
      })

      term.onKey(({ domEvent }) => {
        if (!domEvent.altKey || !domEvent.ctrlKey) return
        const digit = domEvent.key
        if (digit >= '1' && digit <= '4') {
          const idx = Number.parseInt(digit, 10) - 1
          if (idx < paneCount) {
            focusPaneRef.current = idx
            getElectronAPI().muxTerminal.setFocus(sessionId, idx)
            domEvent.preventDefault()
          }
        }
      })

      if (!fitOk) safeFit(true)
      ro = new ResizeObserver(() => safeFit())
      ro.observe(containerRef.current)
      unsubLayoutFit = registerLayoutFitOnResizeEnd(() => safeFit(true))

      if (isFocused) {
        term.focus()
        notifyTerminalFocusReady(sessionId)
      }
      setTermReady(true)
    })()

    return () => {
      disposed = true
      if (onMouseDown) {
        termRef.current?.element?.removeEventListener('mousedown', onMouseDown)
      }
      ro?.disconnect()
      unsubLayoutFit?.()
      unsubData()
      unsubExit?.()
      writeBatcher?.dispose()
      unregisterTerminal(sessionId)
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
      setTermReady(false)
    }
  }, [sessionId, paneCount, tab.id, safeFit])

  useEffect(() => {
    if (!isFocused || !termReady || !sessionId) return
    termRef.current?.focus()
    notifyTerminalFocusReady(sessionId)
  }, [isFocused, termReady, sessionId])

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: chromeBackground }}
    >
      <div
        ref={containerRef}
        className={cn(
          'niozy-terminal-host h-full w-full min-h-0 min-w-0 overflow-hidden',
          terminalHasBackgroundImage && 'niozy-terminal-has-bg-image',
        )}
      />
    </div>
  )
}
