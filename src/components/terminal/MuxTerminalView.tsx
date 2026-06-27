import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { registerTerminal, unregisterTerminal } from '@/lib/terminal-registry'
import { buildTerminalOptions, applyTerminalRuntimeOptions } from '@/lib/terminal-xterm-options'
import {
  createTerminalLigaturesAddonState,
  disposeTerminalLigaturesAddon,
  syncTerminalLigaturesAddon,
} from '@/lib/terminal-ligatures-addon'
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
import { computeMuxGridLayout, paneIndexAtCell } from '@/lib/mux-grid-layout'
import { getXtermCellFromMouseEvent } from '@/lib/mux-xterm-mouse'
import { MuxTerminalFloatingIsland } from '@/components/terminal/MuxTerminalFloatingIsland'
import {
  muxSplitDirectionFromKey,
  resolveMuxLayoutKind,
} from '@/lib/mux-terminal-resize'
import type { MuxLayoutKind } from '../../../electron/shared/mux-terminal-types'
import {
  activePaneCountFromLayoutKind,
  normalizeMuxLayoutKind,
  paneCountFromLayoutKind,
} from '../../../electron/shared/mux-terminal-types'

interface MuxTerminalViewProps {
  tab: AppTab
  isFocused?: boolean
}

export function MuxTerminalView({ tab, isFocused = false }: MuxTerminalViewProps) {
  const { t } = useTranslation()
  const sessionId = tab.terminalId
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ligaturesAddonRef = useRef(createTerminalLigaturesAddonState())
  const focusPaneRef = useRef(0)
  const isTabFocusedRef = useRef(isFocused)
  const layoutKindRef = useRef<MuxLayoutKind>(
    resolveMuxLayoutKind(tab.muxLayoutKind, tab.muxPaneCount),
  )
  const resizeModeRef = useRef(false)
  const [layoutKind, setLayoutKind] = useState<MuxLayoutKind>(layoutKindRef.current)
  const [resizeMode, setResizeMode] = useState(false)
  const terminalSettings = useAppStore((s) => s.settings?.terminal)
  const [termReady, setTermReady] = useState(false)
  const terminalHasBackgroundImage = hasTerminalBackgroundImage(terminalSettings)
  const chromeBackground = terminalHasBackgroundImage
    ? getTerminalCellBackgroundColor(terminalSettings)
    : getTerminalChromeBackgroundColor(terminalSettings)

  const syncLayoutKind = useCallback((next: MuxLayoutKind) => {
    layoutKindRef.current = next
    setLayoutKind(next)
  }, [])

  const exitResizeMode = useCallback(async () => {
    if (!sessionId || !resizeModeRef.current) return
    const ok = await getElectronAPI().muxTerminal.setResizeMode(sessionId, false)
    if (ok) {
      resizeModeRef.current = false
      setResizeMode(false)
    }
  }, [sessionId])

  const enterResizeMode = useCallback(async () => {
    if (!sessionId || activePaneCountFromLayoutKind(layoutKindRef.current) <= 1) return
    const ok = await getElectronAPI().muxTerminal.setResizeMode(sessionId, true)
    if (ok) {
      resizeModeRef.current = true
      setResizeMode(true)
      termRef.current?.focus()
    }
  }, [sessionId])

  const handleClosePane = useCallback(async () => {
    if (!sessionId) return
    await exitResizeMode()
    const result = await getElectronAPI().muxTerminal.closePane(sessionId, focusPaneRef.current)
    if (!result?.ok) return
    const nextLayout = normalizeMuxLayoutKind(result.layoutKind)
    syncLayoutKind(nextLayout)
    if (focusPaneRef.current >= result.paneCount) {
      focusPaneRef.current = Math.max(0, result.paneCount - 1)
    }
    useAppStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id
          ? {
              ...t,
              muxLayoutKind: nextLayout,
              muxPaneCount: paneCountFromLayoutKind(nextLayout),
            }
          : t,
      ),
    }))
  }, [sessionId, tab.id, exitResizeMode, syncLayoutKind])

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
    isTabFocusedRef.current = isFocused
  }, [isFocused])

  useEffect(() => {
    const next = resolveMuxLayoutKind(tab.muxLayoutKind, tab.muxPaneCount)
    syncLayoutKind(next)
  }, [tab.muxLayoutKind, tab.muxPaneCount, syncLayoutKind])

  useEffect(() => {
    if (!sessionId || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubExit: (() => void) | undefined
    let writeBatcher: ReturnType<typeof createMuxTerminalWriteBatcher> | undefined
    let unsubLayoutFit: (() => void) | undefined
    let onMouseDown: ((event: MouseEvent) => void) | undefined
    let onWheel: ((event: WheelEvent) => void) | undefined
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
      const termOptions = {
        ...buildTerminalOptions(
          s?.terminal,
          theme,
          getTerminalCursorOptions(s?.terminal),
          s?.shell?.emojiNativeRendering,
        ),
        scrollback: 0,
      }
      const term = new Terminal(termOptions)
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(containerRef.current)
      termRef.current = term
      fitRef.current = fit
      registerTerminal(sessionId, term)
      if (s?.terminal) {
        applyTerminalRuntimeOptions(term, s.terminal)
      }
      term.options.scrollback = 0
      await syncTerminalLigaturesAddon(term, ligaturesAddonRef.current, s?.terminal, true)
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
      const baseKeyHandler = term.options.customKeyEventHandler
      term.attachCustomKeyEventHandler((event) => {
        if (resizeModeRef.current && event.type === 'keydown') {
          if (event.key === 'Escape') {
            void exitResizeMode()
            return false
          }
          const direction = muxSplitDirectionFromKey(event.key, layoutKindRef.current)
          if (direction) {
            void getElectronAPI().muxTerminal.adjustSplit(sessionId, direction)
            return false
          }
        }
        return baseKeyHandler ? baseKeyHandler(event) : true
      })

      onMouseDown = (event: MouseEvent) => {
        if (activePaneCountFromLayoutKind(layoutKindRef.current) <= 1 || event.button !== 0) return
        const coords = getXtermCellFromMouseEvent(term, event)
        if (!coords) return
        const layout = computeMuxGridLayout(
          term.cols,
          term.rows,
          layoutKindRef.current,
        )
        const paneIndex = paneIndexAtCell(
          layout,
          activePaneCountFromLayoutKind(layoutKindRef.current),
          coords.col,
          coords.row,
        )
        if (paneIndex !== focusPaneRef.current) {
          focusPaneRef.current = paneIndex
          getElectronAPI().muxTerminal.setFocus(sessionId, paneIndex)
        }
        term.focus()
      }
      term.element?.addEventListener('mousedown', onMouseDown)

      onWheel = (event: WheelEvent) => {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (!isTabFocusedRef.current || event.deltaY === 0) return
        const lines = Math.max(1, Math.round(Math.abs(event.deltaY) / 40))
        const delta = event.deltaY < 0 ? lines : -lines
        getElectronAPI().muxTerminal.scroll(sessionId, delta, focusPaneRef.current)
      }
      const wheelTarget = containerRef.current
      wheelTarget?.addEventListener('wheel', onWheel, { passive: false, capture: true })
      term.element?.addEventListener('wheel', onWheel, { passive: false, capture: true })

      term.onData((data) => {
        if (resizeModeRef.current) return
        touchTabActivity(tab.id)
        getElectronAPI().muxTerminal.write(sessionId, data, focusPaneRef.current)
      })

      term.onKey(({ domEvent }) => {
        if (!domEvent.altKey || !domEvent.ctrlKey) return
        const digit = domEvent.key
        if (digit >= '1' && digit <= '4') {
          const idx = Number.parseInt(digit, 10) - 1
          if (idx < activePaneCountFromLayoutKind(layoutKindRef.current)) {
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
      void getElectronAPI().muxTerminal.setResizeMode(sessionId, false)
      resizeModeRef.current = false
      if (onMouseDown) {
        termRef.current?.element?.removeEventListener('mousedown', onMouseDown)
      }
      if (onWheel) {
        containerRef.current?.removeEventListener('wheel', onWheel, { capture: true })
        termRef.current?.element?.removeEventListener('wheel', onWheel, { capture: true })
      }
      ro?.disconnect()
      unsubLayoutFit?.()
      unsubData()
      unsubExit?.()
      writeBatcher?.dispose()
      unregisterTerminal(sessionId)
      disposeTerminalLigaturesAddon(ligaturesAddonRef.current)
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
      setTermReady(false)
      setResizeMode(false)
    }
  }, [sessionId, tab.id, safeFit, exitResizeMode])

  useEffect(() => {
    if (!termRef.current || !terminalSettings) return
    void syncTerminalLigaturesAddon(
      termRef.current,
      ligaturesAddonRef.current,
      terminalSettings,
      true,
    )
  }, [terminalSettings])

  useEffect(() => {
    if (!isFocused || !termReady || !sessionId) return
    termRef.current?.focus()
    notifyTerminalFocusReady(sessionId)
  }, [isFocused, termReady, sessionId])

  useEffect(() => {
    if (isFocused) return
    void exitResizeMode()
  }, [isFocused, exitResizeMode])

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: chromeBackground }}
    >
      <MuxTerminalFloatingIsland
        layoutKind={layoutKind}
        resizeMode={resizeMode}
        onEnterResizeMode={() => void enterResizeMode()}
        onClosePane={() => void handleClosePane()}
      />
      {resizeMode && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-4">
          <div className="rounded-full border border-fuchsia-500/40 bg-background/90 px-3 py-1 text-xs text-fuchsia-700 shadow-sm backdrop-blur-sm dark:text-fuchsia-300">
            {layoutKind === '1x2'
              ? t('muxTerminal.resizeHintVertical')
              : layoutKind === '2x1'
                ? t('muxTerminal.resizeHintHorizontal')
                : t('muxTerminal.resizeHintGrid')}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          'niozy-terminal-host niozy-mux-terminal-host h-full w-full min-h-0 min-w-0 overflow-hidden',
          terminalHasBackgroundImage && 'niozy-terminal-has-bg-image',
        )}
      />
    </div>
  )
}
