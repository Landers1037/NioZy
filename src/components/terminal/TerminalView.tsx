import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import type { Terminal, IDisposable, ITerminalOptions } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { SerializeAddon } from '@xterm/addon-serialize'
import type { WebglAddon } from '@xterm/addon-webgl'
import { useAppStore } from '@/stores/app-store'
import { resolveTerminalThemeWithBackground, hasTerminalBackgroundImage, getTerminalChromeBackgroundColor, getTerminalCellBackgroundColor } from '@/lib/terminal-background'
import type { TerminalViewProps } from './terminal-view-props'
import { getElectronAPI } from '@/lib/electron-client'
import { registerTerminal, unregisterTerminal } from '@/lib/terminal-registry'
import { registerTerminalHost, unregisterTerminalHost } from '@/lib/terminal-host-registry'
import { getTerminalCursorOptions } from '@/lib/terminal-cursor'
import {
  applyInteractiveCliTerminalOptions,
  blockAlternateScreenNonPrimaryMouse,
  handleInteractiveCliMouseDown,
} from '@/lib/terminal-interactive-cli'
import {
  handleTerminalRightClick,
} from '@/lib/terminal-shortcut-actions'
import { resolveTerminalFontFamilyCSSValue } from '../../../electron/shared/terminal-builtin-fonts'
import {
  applyTerminalRuntimeOptions,
  buildTerminalOptions,
} from '@/lib/terminal-xterm-options'
import {
  createTerminalLigaturesAddonState,
  disposeTerminalLigaturesAddon,
  syncTerminalLigaturesAddon,
} from '@/lib/terminal-ligatures-addon'
import {
  applyTerminalShellAddons,
  createTerminalShellAddonState,
} from '@/lib/terminal-shell-addons'
import { DEFAULT_SHELL_SETTINGS } from '../../../electron/shared/shell-settings'
import { notifyTerminalFocusReady } from '@/lib/terminal-focus'
import {
  clearTerminalBracketedPasteState,
  trackTerminalOutputBracketedPaste,
} from '@/lib/terminal-bracketed-paste'
import { writeTerminalInput } from '@/lib/terminal-write'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../electron/shared/preview-settings'
import { isAnyPreviewEnabled } from '@/lib/terminal-preview'
import { bindXtermTerminalPreview } from '@/lib/terminal-preview-mouse'
import {
  isTerminalAdvancedRightClickMenuEnabled,
  isTerminalRightClickCopyPasteEnabled,
  openTerminalAdvancedContextMenu,
} from '@/lib/terminal-advanced-context-menu'
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
} from '@/lib/ssh-reconnect-actions'
import { SshReconnectHint } from '@/components/terminal/SshReconnectHint'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { getAttachPtySnapshotText, restoreTerminalBufferText } from '@/lib/terminal-buffer'
import {
  restoreAttachPtyBufferAsync,
  restoreAttachPtyOffloadAsync,
  serializeAttachPtyBuffer,
  serializeAttachPtyOffloadPlain,
  type AttachPtySnapshotFormat,
} from '@/lib/terminal-buffer-serialize'
import {
  getAttachPtyTabSwitchDwellMs,
  isAttachPtyScrollbackOffloadEnabled,
  isAttachPtyWebglContextPoolEnabled,
  shouldSaveAttachSnapshotOnDetach,
} from '@/lib/attach-pty-render'
import { resolveAttachPtyWebglSlotId } from '@/lib/attach-pty-webgl-pool'
import {
  offloadAttachPtyBuffer,
  takeOffloadedAttachPtyBuffer,
  type AttachPtyOffloadedBuffer,
} from '@/lib/attach-pty-scrollback-offload'
import { createTerminalWriteBatcher, type TerminalWriteBatcher } from '@/lib/terminal-write-batcher'
import { writeXtermOutput } from '@/lib/terminal-sync-output'
import { isTerminalRenderPaused } from '@/lib/terminal-render-pause'
import {
  refreshWebglTextureAtlas,
  scheduleWebglTextureAtlasRefresh,
  waitForTerminalFonts,
} from '@/lib/terminal-webgl-refresh'
import { useTerminalIdleAnimation } from '@/hooks/useTerminalIdleAnimation'
import { TerminalIdleAnimationOverlay } from '@/components/terminal/TerminalIdleAnimationOverlay'
import { getTerminalEmulator, isDomOnlyTerminalEmulator, isWtermEmulator } from '@/lib/terminal-emulator'
import { loadTerminalModules } from '@/lib/ghostty-web-loader'
import { attachTerminalCustomKeyHandler } from '@/lib/terminal-custom-key-handler'

import {
  useAttachPtySessionStore,
  type AttachPtyCommittedSession,
} from '@/stores/attach-pty-session-store'

export type TerminalRuntimeRendererMode = 'dom' | 'webgl' | 'webgl-loading'

function resolveDomFallbackReason(
  preferDom: boolean,
  superPowerSaving: boolean,
  blocked: boolean,
  explicit?: string,
): string | undefined {
  if (explicit) return explicit
  if (superPowerSaving) return 'super-power-saving'
  if (preferDom) return 'split-pane'
  if (blocked) return 'webgl-context-lost'
  return undefined
}

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
  const terminalHostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const tabRef = useRef(tab)
  const boundTerminalIdRef = useRef<string | null>(
    isAttachHost ? (attachSession?.terminalId ?? null) : (tab.terminalId ?? null),
  )
  /** Attach 宿主 remount 后须为 null，否则会误判「已 attach」而跳过快照恢复 */
  const prevAttachSessionRef = useRef<AttachPtyCommittedSession | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const webglRef = useRef<WebglAddon | null>(null)
  const ligaturesAddonsRef = useRef(createTerminalLigaturesAddonState())
  const shellAddonsRef = useRef(createTerminalShellAddonState())
  const previewMouseRef = useRef<IDisposable[]>([])
  /** WebGL 上下文丢失或加载失败后，本会话内不再尝试 WebGL */
  const webglBlockedRef = useRef(false)
  const writeBatcherRef = useRef<TerminalWriteBatcher | null>(null)
  const lastFitRef = useRef({ cols: 0, rows: 0, width: 0, height: 0 })
  const [termReady, setTermReady] = useState(false)
  const [runtimeRenderer, setRuntimeRenderer] = useState<TerminalRuntimeRendererMode>('dom')
  const [runtimeFallback, setRuntimeFallback] = useState<string | undefined>()
  const settings = useAppStore((s) => s.settings)
  const attachPtyWebglPool = isAttachHost && isAttachPtyWebglContextPoolEnabled(settings)
  const attachPtyScrollbackOffload =
    isAttachHost && isAttachPtyScrollbackOffloadEnabled(settings)

  const resolveWebglSlotId = useCallback(
    (terminalId: string | null): string | null => {
      if (!terminalId) return null
      return resolveAttachPtyWebglSlotId(terminalId, attachPtyWebglPool)
    },
    [attachPtyWebglPool],
  )

  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  /**
   * Attach 宿主：committed 变化时立即解除绑定，避免 batcher 里上一 Tab 的积压
   * 在新 terminalId 下写入 xterm（切到 SSH 时尤甚：pwsh 提示符会横排到 MOTD 顶部）。
   * 新会话须在 applyAttachSession 完成快照恢复后再绑定。
   */
  useLayoutEffect(() => {
    if (!isAttachHost) return
    const prev = prevAttachSessionRef.current
    const next = attachSession ?? null
    if (
      next?.terminalId !== prev?.terminalId ||
      next?.tabId !== prev?.tabId
    ) {
      boundTerminalIdRef.current = null
    }
  }, [isAttachHost, attachSession?.tabId, attachSession?.terminalId])

  useEffect(() => {
    if (isAttachHost) return
    boundTerminalIdRef.current = tab.terminalId ?? null
  }, [isAttachHost, tab.terminalId])

  const effectiveTerminalId = isAttachHost
    ? (attachSession?.terminalId ?? null)
    : (tab.terminalId ?? null)

  const webglSlotId =
    effectiveTerminalId != null
      ? resolveAttachPtyWebglSlotId(effectiveTerminalId, attachPtyWebglPool)
      : null

  useEffect(() => {
    const terminalId = effectiveTerminalId
    const host = containerRef.current
    if (!terminalId || !host) return
    registerTerminalHost(terminalId, host)
    return () => unregisterTerminalHost(terminalId)
  }, [effectiveTerminalId])

  const terminalEmulator = getTerminalEmulator(settings)
  const rendererPreference = settings?.terminal.renderer ?? 'webgl'
  const domOnlyEmulator = isDomOnlyTerminalEmulator(settings)
  const superPowerSavingDom =
    settings?.performance.superPowerSaving === true && !isWtermEmulator(settings)
  const terminalHasBackgroundImage = hasTerminalBackgroundImage(settings?.terminal)
  const idleAnimationSettings = settings?.terminal.idleAnimation
  const activeRenderer = domOnlyEmulator
    ? 'dom'
    : effectiveRenderer(rendererPreference, preferDomRenderer || superPowerSavingDom)

  const safeFit = useCallback(
    (force = false): boolean => {
      const el = containerRef.current
      const fit = fitRef.current
      const term = termRef.current
      if (!el || !fit || !term || !hasLayout(el)) return false

      const proposed = fit.proposeDimensions()
      if (!proposed) return false

      const width = el.clientWidth
      const height = el.clientHeight
      const prev = lastFitRef.current
      const sizeUnchanged = prev.width === width && prev.height === height

      if (
        !force &&
        sizeUnchanged &&
        term.cols === proposed.cols &&
        term.rows === proposed.rows
      ) {
        return true
      }

      try {
        fit.fit()
        const { cols, rows } = term
        if (cols !== proposed.cols || rows !== proposed.rows) return false
        lastFitRef.current = { cols, rows, width, height }
        const terminalId = boundTerminalIdRef.current
        if (cols > 0 && rows > 0 && terminalId) {
          if (force || cols !== prev.cols || rows !== prev.rows) {
            getElectronAPI().terminal.resize(terminalId, cols, rows)
          }
        }
        const webgl = webglRef.current
        if (
          webgl &&
          (force ||
            cols !== prev.cols ||
            rows !== prev.rows ||
            width !== prev.width ||
            height !== prev.height)
        ) {
          refreshWebglTextureAtlas(term, webgl)
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
        if (safeFit(force) || attempts >= 48) return
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
    setRuntimeRenderer('dom')
    if (!webgl) return
    try {
      webgl.dispose()
    } catch {
      /* WebGL 上下文已丢失时 dispose 可能报错 */
    }
    const slotId = resolveWebglSlotId(boundTerminalIdRef.current)
    if (slotId && hasWebglSlot(slotId)) {
      releaseWebglSlot(slotId)
    }
  }, [resolveWebglSlotId])

  const loadWebgl = useCallback(async () => {
    const terminalId = boundTerminalIdRef.current
    const slotId = resolveWebglSlotId(terminalId)
    if (!termRef.current || !slotId || webglRef.current) return
    if (webglBlockedRef.current || activeRenderer !== 'webgl') return

    if (!tryAcquireWebglSlot(slotId)) {
      setRuntimeRenderer('dom')
      setRuntimeFallback('webgl-slot-full')
      return
    }

    setRuntimeRenderer('webgl-loading')

    try {
      const { WebglAddon } = await import('@xterm/addon-webgl')
      const term = termRef.current
      if (!term || webglRef.current) {
        if (slotId && hasWebglSlot(slotId)) {
          releaseWebglSlot(slotId)
        }
        setRuntimeRenderer('dom')
        setRuntimeFallback('webgl-cancelled')
        return
      }

      const appSettings = useAppStore.getState().settings
      await waitForTerminalFonts(appSettings?.terminal)
      // WebGL 纹理图集依赖准确的 deviceCell 尺寸；须先 fit 再挂载 addon
      safeFit(true)

      const webgl = new WebglAddon()
      webglRef.current = webgl
      term.loadAddon(webgl)
      touchWebglSlot(slotId)
      setRuntimeRenderer('webgl')
      setRuntimeFallback(undefined)
      webgl.onContextLoss(() => {
        webglBlockedRef.current = true
        setRuntimeFallback('webgl-context-lost')
        disposeWebgl()
        scheduleFit(true)
      })
      const shellAfterWebgl = appSettings?.shell ?? DEFAULT_SHELL_SETTINGS
      const previewAfterWebgl = appSettings?.preview ?? DEFAULT_PREVIEW_SETTINGS
      applyTerminalShellAddons(
        term,
        shellAddonsRef.current,
        shellAfterWebgl,
        previewAfterWebgl,
      )
      scheduleWebglTextureAtlasRefresh(term, webgl, () => safeFit(true))
    } catch {
      webglBlockedRef.current = true
      setRuntimeRenderer('dom')
      setRuntimeFallback('webgl-load-failed')
      disposeWebgl()
    }
  }, [activeRenderer, disposeWebgl, resolveWebglSlotId, safeFit, scheduleFit])

  const applyRenderer = useCallback(() => {
    if (!termRef.current || !termReady) return

    if (activeRenderer === 'dom') {
      disposeWebgl()
      setRuntimeFallback(
        resolveDomFallbackReason(
          preferDomRenderer,
          superPowerSavingDom,
          webglBlockedRef.current,
        ),
      )
      scheduleFit(true)
      return
    }
    if (activeRenderer === 'webgl') {
      if (!webglRef.current && !webglBlockedRef.current) void loadWebgl()
    }
  }, [
    activeRenderer,
    termReady,
    disposeWebgl,
    loadWebgl,
    scheduleFit,
    preferDomRenderer,
    superPowerSavingDom,
  ])

  const detachAttachSession = useCallback(() => {
    const term = termRef.current
    const prev = prevAttachSessionRef.current
    if (!term || !prev) return

    const dwellMs = getAttachPtyTabSwitchDwellMs(useAppStore.getState().settings)
    const saveSnapshot = shouldSaveAttachSnapshotOnDetach(prev, dwellMs)

    if (saveSnapshot) {
      const serializeAddon = serializeAddonRef.current
      if (attachPtyScrollbackOffload) {
        if (serializeAddon) {
          offloadAttachPtyBuffer(prev.tabId, {
            scrollbackText: '',
            screenText: serializeAttachPtyBuffer(term, serializeAddon),
            format: 'vt',
          })
        } else {
          offloadAttachPtyBuffer(prev.tabId, {
            ...serializeAttachPtyOffloadPlain(term),
            format: 'plain',
          })
        }
      } else if (serializeAddon) {
        useAttachPtySessionStore
          .getState()
          .saveSnapshot(prev.tabId, serializeAttachPtyBuffer(term, serializeAddon), 'vt')
      } else {
        useAttachPtySessionStore
          .getState()
          .saveSnapshot(prev.tabId, getAttachPtySnapshotText(term), 'plain')
      }
    }

    unregisterTerminal(prev.terminalId)
    prevAttachSessionRef.current = null
    boundTerminalIdRef.current = null
  }, [attachPtyScrollbackOffload])

  const applyAttachSession = useCallback(
    (session: AttachPtyCommittedSession | null) => {
      const term = termRef.current
      if (!term) return

      boundTerminalIdRef.current = null
      writeBatcherRef.current?.dropPending()

      let offloadedRestore: AttachPtyOffloadedBuffer | undefined
      let snapshotText: string | undefined
      let snapshotFormat: AttachPtySnapshotFormat = 'plain'

      if (session) {
        if (attachPtyScrollbackOffload) {
          offloadedRestore = takeOffloadedAttachPtyBuffer(session.tabId)
        } else {
          const snap = useAttachPtySessionStore.getState().takeSnapshot(session.tabId)
          if (snap) {
            snapshotText = snap.bufferText
            snapshotFormat = snap.format ?? 'plain'
          }
        }
      }

      detachAttachSession()

      if (!session) {
        // clear() 会保留提示符行；Attach 切换须 reset() (RIS)
        term.reset()
        return
      }

      prevAttachSessionRef.current = session
      term.reset()
      safeFit(true)

      const finishAttach = (): void => {
        boundTerminalIdRef.current = session.terminalId
        registerTerminal(session.terminalId, term)
        scheduleFit(true)
        term.focus()

        const claimId = session.terminalId
        void getElectronAPI()
          .terminal.claimStream(claimId)
          .then((replay) => {
            if (!replay || boundTerminalIdRef.current !== claimId) return
            trackTerminalOutputBracketedPaste(claimId, replay)
            writeBatcherRef.current?.queue(replay, claimId)
          })
          .catch(() => {
            /* 忽略 claim 失败 */
          })
      }

      if (offloadedRestore) {
        restoreAttachPtyOffloadAsync(
          term,
          offloadedRestore.scrollbackText,
          offloadedRestore.screenText,
          offloadedRestore.format ?? 'plain',
          finishAttach,
        )
      } else if (snapshotText) {
        restoreAttachPtyBufferAsync(term, snapshotText, snapshotFormat, finishAttach)
      } else {
        finishAttach()
      }
    },
    [detachAttachSession, safeFit, scheduleFit, attachPtyScrollbackOffload],
  )

  useEffect(() => {
    if (isAttachHost) return
    if (!tab.terminalId || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined
    let writeBatcher: ReturnType<typeof createTerminalWriteBatcher> | undefined
    let unsubLayoutFit: (() => void) | undefined
    let termElement: HTMLElement | undefined
    let onLeftMouseDown: ((e: MouseEvent) => void) | undefined
    let onRightMouseUp: ((e: MouseEvent) => void) | undefined
    let onContextMenu: ((e: MouseEvent) => void) | undefined
    let stopInputA11y: (() => void) | undefined
    let unsubRenderFit: IDisposable | undefined
    const captureOpts = { capture: true } as const

    void (async () => {
      const s = useAppStore.getState().settings
      const emulator = getTerminalEmulator(s)
      const { Terminal, FitAddon, ghostty } = await loadTerminalModules(emulator)

      if (disposed || !containerRef.current) return

      if (s?.terminal?.useBuiltinFont) {
        await waitForTerminalFonts(s.terminal)
      }
      if (disposed || !containerRef.current) return

      const scheme = s?.terminal.colorScheme ?? 'atom'
      const theme = resolveTerminalThemeWithBackground(scheme, s?.terminal)
      const shellSettings = s?.shell ?? DEFAULT_SHELL_SETTINGS
      const previewSettings = s?.preview ?? DEFAULT_PREVIEW_SETTINGS
      const termOptions = buildTerminalOptions(
        s?.terminal,
        theme,
        getTerminalCursorOptions(s?.terminal),
        shellSettings.emojiNativeRendering,
      )
      const term = ghostty
        ? (new Terminal({ ...termOptions, ghostty } as ITerminalOptions) as Terminal)
        : new Terminal(termOptions)

      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(containerRef.current)
      unsubRenderFit = term.onRender(() => {
        if (safeFit(true)) {
          unsubRenderFit?.dispose()
          unsubRenderFit = undefined
        }
      })
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
        restoreTerminalBufferText(term, snap.bufferText)
      }

      applyTerminalShellAddons(
        term,
        shellAddonsRef.current,
        shellSettings,
        previewSettings,
        emulator,
      )
      await syncTerminalLigaturesAddon(
        term,
        ligaturesAddonsRef.current,
        s?.terminal,
        emulator === 'xterm',
      )

      writeBatcher = createTerminalWriteBatcher(
        () => termRef.current,
        () => useAppStore.getState().settings,
        () => boundTerminalIdRef.current,
        (terminalId, length) => getElectronAPI().terminal.ackData(terminalId, length),
      )
      writeBatcherRef.current = writeBatcher

      const api = getElectronAPI()
      const onData = (data: string) => {
        const terminalId = boundTerminalIdRef.current
        if (!terminalId) return
        writeTerminalInput(terminalId, data)
      }
      term.onData(onData)

      attachTerminalCustomKeyHandler(term, emulator, {
        getTab: () => tabRef.current,
        getTerminalId: () => boundTerminalIdRef.current,
        term,
      })

      termElement = term.element ?? undefined

      const readTerminalSettings = () => useAppStore.getState().settings?.terminal

      const isRightClickCopyPasteEnabled = () => {
        const terminalSettings = readTerminalSettings()
        return (
          !!boundTerminalIdRef.current &&
          isTerminalRightClickCopyPasteEnabled(terminalSettings)
        )
      }

      const isAdvancedRightClickMenuEnabled = () => {
        const terminalSettings = readTerminalSettings()
        return (
          !!boundTerminalIdRef.current &&
          isTerminalAdvancedRightClickMenuEnabled(terminalSettings)
        )
      }

      onLeftMouseDown = (e: MouseEvent) => {
        if (blockAlternateScreenNonPrimaryMouse(term, e)) return
        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        handleInteractiveCliMouseDown(term, e, shell.shiftEnterNewline)
      }

      onRightMouseUp = (e: MouseEvent) => {
        const terminalId = boundTerminalIdRef.current
        if (e.button !== 2) return
        if (term.buffer.active.type === 'alternate') {
          if (terminalId && isRightClickCopyPasteEnabled()) {
            handleTerminalRightClick(terminalId, e, term)
          }
          e.preventDefault()
          e.stopImmediatePropagation()
          return
        }
        if (!terminalId || !isRightClickCopyPasteEnabled()) return
        handleTerminalRightClick(terminalId, e, term)
      }

      onContextMenu = (e: MouseEvent) => {
        const terminalId = boundTerminalIdRef.current
        if (isRightClickCopyPasteEnabled()) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (!terminalId || !isAdvancedRightClickMenuEnabled()) return
        openTerminalAdvancedContextMenu(e, terminalId, tabRef.current.id, term)
      }

      termElement?.addEventListener('mousedown', onLeftMouseDown, captureOpts)
      termElement?.addEventListener('mouseup', onRightMouseUp, captureOpts)
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
        if (id !== boundTerminalIdRef.current || isTerminalRenderPaused()) return
        trackTerminalOutputBracketedPaste(id, data)
        writeBatcher?.queue(data, id)
      })

      const claimId = boundTerminalIdRef.current
      if (claimId) {
        const replay = await api.terminal.claimStream(claimId)
        if (replay) {
          trackTerminalOutputBracketedPaste(claimId, replay)
          writeBatcher?.queue(replay, claimId)
        }
      }

      unsubExit = api.terminal.onExit((id, code) => {
        if (id === boundTerminalIdRef.current) {
          clearTerminalBracketedPasteState(id)
          writeXtermOutput(
            term,
            formatTerminalExitMessage(code),
            useAppStore.getState().settings,
          )
          markSshTerminalDisconnected(id, tabRef.current)
        }
      })

      scheduleFit(true)
      setTermReady(true)
      const focusId = boundTerminalIdRef.current
      if (focusId) notifyTerminalFocusReady(focusId)
    })()

    return () => {
      disposed = true
      setTermReady(false)
      webglBlockedRef.current = false
      lastFitRef.current = { cols: 0, rows: 0, width: 0, height: 0 }
      disposeWebgl()
      if (termElement && onLeftMouseDown && onRightMouseUp && onContextMenu) {
        termElement.removeEventListener('mousedown', onLeftMouseDown, captureOpts)
        termElement.removeEventListener('mouseup', onRightMouseUp, captureOpts)
        termElement.removeEventListener('contextmenu', onContextMenu, captureOpts)
      }
      stopInputA11y?.()
      unsubRenderFit?.dispose()
      unsubData?.()
      unsubExit?.()
      writeBatcher?.dispose()
      writeBatcherRef.current = null
      unsubLayoutFit?.()
      ro?.disconnect()
      if (tab.terminalId) {
        clearTerminalBracketedPasteState(tab.terminalId)
        unregisterTerminal(tab.terminalId)
      }
      shellAddonsRef.current = createTerminalShellAddonState()
      disposeTerminalLigaturesAddon(ligaturesAddonsRef.current)
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [tab.terminalId, scheduleFit, disposeWebgl, isAttachHost, safeFit])

  useEffect(() => {
    if (!isAttachHost || termRef.current || !containerRef.current) return

    let disposed = false
    let ro: ResizeObserver | null = null
    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined
    let writeBatcher: ReturnType<typeof createTerminalWriteBatcher> | undefined
    let unsubLayoutFit: (() => void) | undefined
    let termElement: HTMLElement | undefined
    let onLeftMouseDown: ((e: MouseEvent) => void) | undefined
    let onRightMouseUp: ((e: MouseEvent) => void) | undefined
    let onContextMenu: ((e: MouseEvent) => void) | undefined
    let stopInputA11y: (() => void) | undefined
    let unsubRenderFit: IDisposable | undefined
    const captureOpts = { capture: true } as const

    void (async () => {
      const s = useAppStore.getState().settings
      const emulator = getTerminalEmulator(s)
      const { Terminal, FitAddon, ghostty, SerializeAddon } = await loadTerminalModules(
        emulator,
        { includeSerialize: emulator === 'xterm' },
      )

      if (disposed || !containerRef.current) return

      if (s?.terminal?.useBuiltinFont) {
        await waitForTerminalFonts(s.terminal)
      }
      if (disposed || !containerRef.current) return

      const scheme = s?.terminal.colorScheme ?? 'atom'
      const theme = resolveTerminalThemeWithBackground(scheme, s?.terminal)
      const shellSettings = s?.shell ?? DEFAULT_SHELL_SETTINGS
      const previewSettings = s?.preview ?? DEFAULT_PREVIEW_SETTINGS
      const termOptions = buildTerminalOptions(
        s?.terminal,
        theme,
        getTerminalCursorOptions(s?.terminal),
        shellSettings.emojiNativeRendering,
      )
      const term = ghostty
        ? (new Terminal({ ...termOptions, ghostty } as ITerminalOptions) as Terminal)
        : new Terminal(termOptions)

      const fit = new FitAddon()
      term.loadAddon(fit)
      if (SerializeAddon) {
        const serializeAddon = new SerializeAddon()
        term.loadAddon(serializeAddon)
        serializeAddonRef.current = serializeAddon
      }
      term.open(containerRef.current)
      unsubRenderFit = term.onRender(() => {
        if (safeFit(true)) {
          unsubRenderFit?.dispose()
          unsubRenderFit = undefined
        }
      })
      stopInputA11y = observeTerminalInputA11y(
        containerRef.current,
        i18n.t('terminal.inputAriaLabel'),
      )
      applyInteractiveCliTerminalOptions(term, shellSettings.shiftEnterNewline)

      termRef.current = term
      fitRef.current = fit

      applyTerminalShellAddons(
        term,
        shellAddonsRef.current,
        shellSettings,
        previewSettings,
        emulator,
      )
      await syncTerminalLigaturesAddon(
        term,
        ligaturesAddonsRef.current,
        s?.terminal,
        emulator === 'xterm',
      )

      writeBatcher = createTerminalWriteBatcher(
        () => termRef.current,
        () => useAppStore.getState().settings,
        () => boundTerminalIdRef.current,
        (terminalId, length) => getElectronAPI().terminal.ackData(terminalId, length),
      )
      writeBatcherRef.current = writeBatcher

      const api = getElectronAPI()
      const onData = (data: string) => {
        const terminalId = boundTerminalIdRef.current
        if (!terminalId) return
        writeTerminalInput(terminalId, data)
      }
      term.onData(onData)

      attachTerminalCustomKeyHandler(term, emulator, {
        getTab: () => tabRef.current,
        getTerminalId: () => boundTerminalIdRef.current,
        term,
      })

      termElement = term.element ?? undefined

      const readTerminalSettings = () => useAppStore.getState().settings?.terminal

      const isRightClickCopyPasteEnabled = () => {
        const terminalSettings = readTerminalSettings()
        return (
          !!boundTerminalIdRef.current &&
          isTerminalRightClickCopyPasteEnabled(terminalSettings)
        )
      }

      const isAdvancedRightClickMenuEnabled = () => {
        const terminalSettings = readTerminalSettings()
        return (
          !!boundTerminalIdRef.current &&
          isTerminalAdvancedRightClickMenuEnabled(terminalSettings)
        )
      }

      onLeftMouseDown = (e: MouseEvent) => {
        if (blockAlternateScreenNonPrimaryMouse(term, e)) return
        const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
        handleInteractiveCliMouseDown(term, e, shell.shiftEnterNewline)
      }

      onRightMouseUp = (e: MouseEvent) => {
        const terminalId = boundTerminalIdRef.current
        if (e.button !== 2) return
        if (term.buffer.active.type === 'alternate') {
          if (terminalId && isRightClickCopyPasteEnabled()) {
            handleTerminalRightClick(terminalId, e, term)
          }
          e.preventDefault()
          e.stopImmediatePropagation()
          return
        }
        if (!terminalId || !isRightClickCopyPasteEnabled()) return
        handleTerminalRightClick(terminalId, e, term)
      }

      onContextMenu = (e: MouseEvent) => {
        const terminalId = boundTerminalIdRef.current
        if (isRightClickCopyPasteEnabled()) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (!terminalId || !isAdvancedRightClickMenuEnabled()) return
        openTerminalAdvancedContextMenu(e, terminalId, tabRef.current.id, term)
      }

      termElement?.addEventListener('mousedown', onLeftMouseDown, captureOpts)
      termElement?.addEventListener('mouseup', onRightMouseUp, captureOpts)
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
        if (id !== boundTerminalIdRef.current || isTerminalRenderPaused()) return
        trackTerminalOutputBracketedPaste(id, data)
        writeBatcher?.queue(data, id)
      })

      unsubExit = api.terminal.onExit((id, code) => {
        if (id === boundTerminalIdRef.current) {
          clearTerminalBracketedPasteState(id)
          writeXtermOutput(
            term,
            formatTerminalExitMessage(code),
            useAppStore.getState().settings,
          )
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
      disposeWebgl()
      if (termElement && onLeftMouseDown && onRightMouseUp && onContextMenu) {
        termElement.removeEventListener('mousedown', onLeftMouseDown, captureOpts)
        termElement.removeEventListener('mouseup', onRightMouseUp, captureOpts)
        termElement.removeEventListener('contextmenu', onContextMenu, captureOpts)
      }
      stopInputA11y?.()
      unsubRenderFit?.dispose()
      unsubData?.()
      unsubExit?.()
      writeBatcher?.dispose()
      writeBatcherRef.current = null
      unsubLayoutFit?.()
      ro?.disconnect()
      const clearedTerminalId = boundTerminalIdRef.current
      if (clearedTerminalId) clearTerminalBracketedPasteState(clearedTerminalId)
      shellAddonsRef.current = createTerminalShellAddonState()
      disposeTerminalLigaturesAddon(ligaturesAddonsRef.current)
      serializeAddonRef.current?.dispose()
      serializeAddonRef.current = null
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [isAttachHost, scheduleFit, disposeWebgl, detachAttachSession, safeFit, applyAttachSession])

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
    if (!termReady || !webglSlotId || activeRenderer !== 'webgl' || domOnlyEmulator) return

    const unregisterEvict = registerWebglEvictHandler(webglSlotId, () => {
      disposeWebgl()
    })

    void loadWebgl()

    return () => {
      unregisterEvict()
    }
  }, [termReady, webglSlotId, activeRenderer, loadWebgl, disposeWebgl])

  const syncPreviewMouse = useCallback(() => {
    for (const d of previewMouseRef.current) d.dispose()
    previewMouseRef.current = []
    const term = termRef.current
    if (!term || !settings) return
    const shell = settings.shell ?? DEFAULT_SHELL_SETTINGS
    const preview = settings.preview ?? DEFAULT_PREVIEW_SETTINGS
    const needPreviewMouse =
      isAnyPreviewEnabled(preview) || (shell.clickToOpenLinks && shell.highlightLinks)
    if (!needPreviewMouse) return
    bindXtermTerminalPreview(
      term,
      {
        preview,
        shell,
        isSsh: !!tabRef.current.sshConnectionId,
        getCwd: () => {
          const tid = boundTerminalIdRef.current
          return tid ? useAppStore.getState().terminalCwds[tid] : undefined
        },
      },
      previewMouseRef.current,
    )
  }, [settings])

  useEffect(() => {
    if (!termReady || !termRef.current || !settings) return
    const shell = settings.shell ?? DEFAULT_SHELL_SETTINGS
    const preview = settings.preview ?? DEFAULT_PREVIEW_SETTINGS
    applyInteractiveCliTerminalOptions(termRef.current, shell.shiftEnterNewline)
    applyTerminalShellAddons(
      termRef.current,
      shellAddonsRef.current,
      shell,
      preview,
      getTerminalEmulator(settings),
    )
    syncPreviewMouse()
  }, [termReady, settings?.shell, settings?.preview, syncPreviewMouse])

  useEffect(() => {
    const terminalSettings = settings?.terminal
    if (!termRef.current || !terminalSettings) return
    const cursor = getTerminalCursorOptions(terminalSettings)
    termRef.current.options.theme = resolveTerminalThemeWithBackground(
      terminalSettings.colorScheme,
      terminalSettings,
    )
    termRef.current.options.fontFamily = resolveTerminalFontFamilyCSSValue(terminalSettings)
    termRef.current.options.fontSize = terminalSettings.fontSize
    termRef.current.options.fontWeight = terminalSettings.fontWeight
    termRef.current.options.fontWeightBold = terminalSettings.fontWeightBold
    termRef.current.options.cursorBlink = cursor.cursorBlink
    termRef.current.options.cursorStyle = cursor.cursorStyle
    applyTerminalRuntimeOptions(termRef.current, terminalSettings)
    scheduleFit()
    refreshWebglTextureAtlas(termRef.current, webglRef.current)
    void syncTerminalLigaturesAddon(
      termRef.current,
      ligaturesAddonsRef.current,
      terminalSettings,
      terminalEmulator === 'xterm',
    ).then((changed) => {
      if (!changed || terminalEmulator !== 'xterm' || activeRenderer !== 'webgl') return
      disposeWebgl()
      if (!webglBlockedRef.current) {
        void loadWebgl()
      }
    })
  }, [settings?.terminal, terminalEmulator, scheduleFit, activeRenderer, disposeWebgl, loadWebgl])

  useEffect(() => {
    if (!termReady) return
    if (activeRenderer !== 'webgl') {
      webglBlockedRef.current = false
    }
    applyRenderer()
  }, [activeRenderer, termReady, applyRenderer])

  useEffect(() => {
    if (!termReady || !termRef.current || !effectiveTerminalId) return
    if (isFocused) {
      touchTabActivity(tab.id)
      if (activeRenderer === 'webgl' && webglSlotId) {
        touchWebglSlot(webglSlotId)
      }
      safeFit()
      termRef.current.focus()
      notifyTerminalFocusReady(effectiveTerminalId)
      if (
        activeRenderer === 'webgl' &&
        !webglRef.current &&
        !webglBlockedRef.current
      ) {
        void loadWebgl()
      }
      return
    }
    termRef.current.blur()
  }, [
    isFocused,
    termReady,
    safeFit,
    effectiveTerminalId,
    webglSlotId,
    loadWebgl,
    activeRenderer,
    tab.id,
  ])

  const getIdleAnimationTerm = useCallback(() => termRef.current, [])

  const { active: idleAnimationActive } = useTerminalIdleAnimation({
    enabled: idleAnimationSettings?.enabled === true,
    idleDelayMs: idleAnimationSettings?.idleDelayMs ?? 5000,
    getTerm: getIdleAnimationTerm,
    termReady,
    isFocused,
  })

  const chromeBackground = hasTerminalBackgroundImage(settings?.terminal)
    ? getTerminalCellBackgroundColor(settings?.terminal)
    : getTerminalChromeBackgroundColor(settings?.terminal)

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: chromeBackground }}
    >
      <div ref={terminalHostRef} className="relative h-full w-full">
        <div
          ref={containerRef}
          className={
            terminalHasBackgroundImage
              ? 'niozy-terminal-host niozy-terminal-has-bg-image h-full w-full overflow-hidden'
              : 'niozy-terminal-host h-full w-full overflow-hidden'
          }
          data-niozy-renderer={runtimeRenderer}
          data-niozy-renderer-fallback={runtimeFallback ?? undefined}
          data-niozy-renderer-preference={rendererPreference}
        />
        {termReady && termRef.current && idleAnimationSettings?.enabled && (
          <TerminalIdleAnimationOverlay
            term={termRef.current}
            mode={idleAnimationSettings.mode}
            enabled={idleAnimationActive}
            hostRef={terminalHostRef}
          />
        )}
      </div>
      <SshReconnectHint terminalId={effectiveTerminalId ?? undefined} />
    </div>
  )
}
