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
import { applyInteractiveCliTerminalOptions } from '@/lib/terminal-interactive-cli'
import { attachTerminalCustomKeyHandler } from '@/lib/terminal-custom-key-handler'
import { DEFAULT_SHELL_SETTINGS } from '../../../electron/shared/shell-settings'
import { loadTerminalModules } from '@/lib/ghostty-web-loader'
import { waitForTerminalFonts } from '@/lib/terminal-webgl-refresh'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { notifyTerminalFocusReady } from '@/lib/terminal-focus'
import { isLayoutResizing, registerLayoutFitOnResizeEnd } from '@/lib/layout-resize'
import { muxTerminalLog } from '@/lib/mux-terminal-log'

interface MuxTerminalViewProps {
  tab: AppTab
  isFocused?: boolean
}

export function MuxTerminalView({ tab, isFocused = false }: MuxTerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const focusPaneRef = useRef(0)
  const sessionId = tab.terminalId
  const paneCount = tab.muxPaneCount ?? 4
  const terminalSettings = useAppStore((s) => s.settings?.terminal)
  const [termReady, setTermReady] = useState(false)
  const terminalHasBackgroundImage = hasTerminalBackgroundImage(terminalSettings)
  const chromeBackground = terminalHasBackgroundImage
    ? getTerminalCellBackgroundColor(terminalSettings)
    : getTerminalChromeBackgroundColor(terminalSettings)

  const safeFit = useCallback((force = false) => {
    const term = termRef.current
    const fit = fitRef.current
    const el = containerRef.current
    if (!term || !fit || !el || el.clientWidth < 2 || el.clientHeight < 2) return false
    if (isLayoutResizing() && !force) return false
    fit.fit()
    const cols = term.cols
    const rows = term.rows
    if (sessionId) {
      getElectronAPI().muxTerminal.resize(sessionId, cols, rows)
    }
    return true
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubExit: (() => void) | undefined
    let writeBatcher: ReturnType<typeof createMuxTerminalWriteBatcher> | undefined
    let unsubLayoutFit: (() => void) | undefined
    const pendingChunks: string[] = []
    let pendingBytes = 0
    let liveDataCount = 0
    let liveDataBytes = 0

    muxTerminalLog.info('mount effect start', { sessionId, tabId: tab.id })

    // 必须在任何 await 之前订阅，避免父级 setActiveStreams 抢先 flush 导致 IPC 丢失
    const unsubData = getElectronAPI().muxTerminal.onData((id, data) => {
      if (id !== sessionId || disposed) return
      liveDataCount += 1
      liveDataBytes += data.length
      if (liveDataCount === 1) {
        muxTerminalLog.info('first onData', { sessionId, bytes: data.length, pendingBytes })
      } else if (liveDataCount % 50 === 0) {
        muxTerminalLog.debug('onData stats', { sessionId, liveDataCount, liveDataBytes })
      }
      if (writeBatcher) {
        writeBatcher.queue(data)
      } else {
        pendingChunks.push(data)
        pendingBytes += data.length
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
      const container = containerRef.current
      muxTerminalLog.info('xterm opened', {
        sessionId,
        width: container.clientWidth,
        height: container.clientHeight,
        pendingChunks: pendingChunks.length,
        pendingBytes,
      })
      termRef.current = term
      fitRef.current = fit
      registerTerminal(sessionId, term)
      applyTerminalRuntimeOptions(term, s?.terminal)
      applyInteractiveCliTerminalOptions(term, s?.shell?.shiftEnterNewline ?? DEFAULT_SHELL_SETTINGS.shiftEnterNewline)

      const fitOk = safeFit(true)
      muxTerminalLog.info('initial fit (before replay)', {
        sessionId,
        fitOk,
        cols: term.cols,
        rows: term.rows,
      })

      writeBatcher = createMuxTerminalWriteBatcher(
        () => termRef.current,
        () => useAppStore.getState().settings,
        () => sessionId,
        (id, len) => getElectronAPI().muxTerminal.ackData(id, len),
      )

      for (const chunk of pendingChunks) {
        writeBatcher.queue(chunk)
      }
      pendingChunks.length = 0
      pendingBytes = 0

      const replay = await getElectronAPI().muxTerminal.claimStream(sessionId)
      if (replay) writeBatcher.queue(replay)
      muxTerminalLog.info('claimStream done', {
        sessionId,
        replayBytes: replay.length,
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
      ro?.disconnect()
      unsubLayoutFit?.()
      unsubData()
      unsubExit?.()
      writeBatcher?.dispose()
      if (sessionId) unregisterTerminal(sessionId)
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
      setTermReady(false)
    }
  }, [sessionId, paneCount, tab.id, safeFit])

  useEffect(() => {
    if (!isFocused || !termReady) return
    termRef.current?.focus()
    notifyTerminalFocusReady(sessionId ?? '')
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
