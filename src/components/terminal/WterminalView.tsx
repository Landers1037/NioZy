import { useEffect, useCallback, useRef, useState, type CSSProperties } from 'react'
import { Terminal, useTerminal } from '@wterm/react'
import type { WTerm } from '@wterm/dom'
import type { TerminalCore } from '@wterm/core'
import '@wterm/react/css'
import wtermWasmUrl from '@wterm/core/wasm?url'
import { useAppStore } from '@/stores/app-store'
import { hasTerminalBackgroundImage, getTerminalChromeBackgroundColor, getTerminalCellBackgroundColor } from '@/lib/terminal-background'
import { resolveTerminalFontFamily } from '../../../electron/shared/terminal-builtin-fonts'
import { buildWtermFontStyle, getWtermThemeId } from '@/lib/wterm-theme'
import { getElectronAPI } from '@/lib/electron-client'
import { getTerminalCursorOptions } from '@/lib/terminal-cursor'
import { attachWtermDomShellFeatures } from '@/lib/wterm-dom-shell'
import {
  handleTerminalCopyWhenSelection,
  handleTerminalKeyboardShortcut,
  handleTerminalModifiedEnterKey,
} from '@/lib/terminal-shortcut-actions'
import { handleTerminalTabNavigationShortcut } from '@/lib/app-shortcut-actions'
import { DEFAULT_SHELL_SETTINGS } from '../../../electron/shared/shell-settings'
import { writeTerminalInput } from '@/lib/terminal-write'
import {
  readWtermCursorCommandFromInstance,
  registerWtermCursorLine,
  unregisterWtermCursorLine,
} from '@/lib/command-replay-capture'
import {
  notifyTerminalFocusReady,
  registerWtermFocus,
  unregisterWtermFocus,
} from '@/lib/terminal-focus'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../electron/shared/preview-settings'
import { DEFAULT_GHOSTTY_SCROLLBACK_LIMIT } from '../../../electron/shared/experimental-settings'
import { ghosttyWasmUrl, loadWtermGhosttyCore } from '@/lib/wterm-ghostty-core'
import i18n from '@/lib/i18n'
import { queueWtermScrollToBottom } from '@/lib/wterm-scroll'
import { observeTerminalInputA11y } from '@/lib/terminal-input-a11y'
import {
  formatTerminalExitMessage,
  markSshTerminalDisconnected,
  tryHandleSshReconnectEnter,
} from '@/lib/ssh-reconnect-actions'
import { SshReconnectHint } from '@/components/terminal/SshReconnectHint'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { registerTerminalHost, unregisterTerminalHost } from '@/lib/terminal-host-registry'
import type { TerminalViewProps } from './terminal-view-props'

export function WterminalView({ tab, isFocused = false }: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { ref: termRef, write, focus } = useTerminal()
  const settings = useAppStore((s) => s.settings)
  const shellCleanupRef = useRef<(() => void) | null>(null)
  const ghosttyCoreEnabled = settings?.experimental?.ghosttyCoreEnabled === true
  const ghosttyScrollbackLimit =
    settings?.experimental?.ghosttyScrollbackLimit ?? DEFAULT_GHOSTTY_SCROLLBACK_LIMIT
  const [ghosttyCore, setGhosttyCore] = useState<TerminalCore | null>(null)
  const [ghosttyCoreLoading, setGhosttyCoreLoading] = useState(false)

  const colorScheme = settings?.terminal.colorScheme ?? 'atom'
  const wtermThemeId = getWtermThemeId(colorScheme)
  const chromeBackground = hasTerminalBackgroundImage(settings?.terminal)
    ? getTerminalCellBackgroundColor(settings?.terminal)
    : getTerminalChromeBackgroundColor(settings?.terminal)

  const wtermFontStyle = settings
    ? ({
        ...buildWtermFontStyle(
          resolveTerminalFontFamily(settings.terminal),
          settings.terminal.fontSize,
          settings.terminal.fontWeight,
          settings.terminal.fontWeightBold,
        ),
        ...(hasTerminalBackgroundImage(settings.terminal)
          ? ({ '--term-bg': getTerminalCellBackgroundColor(settings.terminal) } as CSSProperties)
          : {}),
      } satisfies CSSProperties)
    : undefined

  const cursor = settings ? getTerminalCursorOptions(settings.terminal) : { cursorBlink: true }

  const detachShellFeatures = useCallback(() => {
    shellCleanupRef.current?.()
    shellCleanupRef.current = null
  }, [])

  const attachShellFeatures = useCallback(
    (instance: WTerm) => {
      detachShellFeatures()
      const terminalId = tab.terminalId
      if (!terminalId || !settings) return

      const listeners: Array<() => void> = []
      const captureOpts = { capture: true } as const

      listeners.push(
        attachWtermDomShellFeatures(instance, {
          terminalId,
          tabId: tab.id,
          rightClickCopyPaste: settings.terminal.rightClickCopyPaste,
          advancedRightClickMenu: settings.terminal.advancedRightClickMenu,
          shell: settings.shell ?? DEFAULT_SHELL_SETTINGS,
          preview: settings.preview ?? DEFAULT_PREVIEW_SETTINGS,
          isSsh: !!tab.sshConnectionId,
          getCwd: () => useAppStore.getState().terminalCwds[terminalId],
        }),
      )

      const onKeyDown = (event: KeyboardEvent) => {
        if (handleTerminalTabNavigationShortcut(event)) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        if (tryHandleSshReconnectEnter(tab, terminalId, event)) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        const shell = settings.shell ?? DEFAULT_SHELL_SETTINGS
        if (
          handleTerminalModifiedEnterKey(terminalId, event, shell.shiftEnterNewline)
        ) {
          event.stopPropagation()
          return
        }

        const shortcuts = settings.shortcuts?.app
        if (!shortcuts) return

        if (handleTerminalCopyWhenSelection(event)) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        if (handleTerminalKeyboardShortcut(terminalId, shortcuts, event)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }

      instance.element.addEventListener('keydown', onKeyDown, captureOpts)
      listeners.push(() =>
        instance.element.removeEventListener('keydown', onKeyDown, captureOpts),
      )

      shellCleanupRef.current = () => {
        for (const off of listeners) off()
      }
    },
    [tab, settings, detachShellFeatures],
  )

  useEffect(() => {
    if (!tab.terminalId) return

    const api = getElectronAPI()

    const unsubData = api.terminal.onData((id, data) => {
      if (id !== tab.terminalId) return
      write(data)
      queueWtermScrollToBottom(termRef.current?.instance?.element)
    })

    const unsubExit = api.terminal.onExit((id, code) => {
      if (id === tab.terminalId) {
        write(formatTerminalExitMessage(code))
        markSshTerminalDisconnected(id, tab)
        queueWtermScrollToBottom(termRef.current?.instance?.element, { force: true })
      }
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [tab.terminalId, write, termRef])

  useEffect(() => {
    return () => detachShellFeatures()
  }, [detachShellFeatures])

  useEffect(() => {
    const instance = termRef.current?.instance
    if (instance) attachShellFeatures(instance)
  }, [
    settings?.terminal.rightClickCopyPaste,
    settings?.terminal.advancedRightClickMenu,
    settings?.shell?.clickToOpenLinks,
    settings?.shell?.highlightLinks,
    settings?.shell?.highlightLogLevels,
    settings?.shell?.shiftEnterNewline,
    settings?.preview,
    settings?.shortcuts,
    tab.sshConnectionId,
    attachShellFeatures,
    termRef,
  ])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    return observeTerminalInputA11y(host, i18n.t('terminal.inputAriaLabel'))
  }, [])

  useEffect(() => {
    if (isFocused) {
      touchTabActivity(tab.id)
      focus()
      return
    }
    const root = termRef.current?.instance?.element
    root?.querySelector('textarea')?.blur()
  }, [isFocused, focus, termRef])

  useEffect(() => {
    const terminalId = tab.terminalId
    if (!terminalId) return
    registerWtermFocus(terminalId, () => focus())
    registerWtermCursorLine(terminalId, () => {
      const instance = termRef.current?.instance
      return instance ? readWtermCursorCommandFromInstance(instance) : null
    })
    return () => {
      unregisterWtermFocus(terminalId)
      unregisterWtermCursorLine(terminalId)
    }
  }, [tab.terminalId, focus, termRef])

  const handleData = useCallback(
    (data: string) => {
      if (!tab.terminalId) return
      touchTabActivity(tab.id)
      writeTerminalInput(tab.terminalId, data)
    },
    [tab.id, tab.terminalId],
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (tab.terminalId && cols > 0 && rows > 0) {
        getElectronAPI().terminal.resize(tab.terminalId, cols, rows)
      }
    },
    [tab.terminalId],
  )

  const handleReady = useCallback(
    (instance: WTerm) => {
      attachShellFeatures(instance)
      if (isFocused) focus()
      if (tab.terminalId) notifyTerminalFocusReady(tab.terminalId)
    },
    [attachShellFeatures, isFocused, focus, tab.terminalId],
  )

  useEffect(() => {
    const terminalId = tab.terminalId
    const host = hostRef.current
    if (!terminalId || !host) return
    registerTerminalHost(terminalId, host)
    return () => unregisterTerminalHost(terminalId)
  }, [tab.terminalId])

  useEffect(() => {
    if (!ghosttyCoreEnabled) {
      setGhosttyCore(null)
      setGhosttyCoreLoading(false)
      return
    }

    let cancelled = false
    setGhosttyCore(null)
    setGhosttyCoreLoading(true)

    void loadWtermGhosttyCore({
      wasmPath: ghosttyWasmUrl,
      scrollbackLimit: ghosttyScrollbackLimit,
    })
      .then((core) => {
        if (!cancelled) {
          setGhosttyCore(core)
          setGhosttyCoreLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGhosttyCore(null)
          setGhosttyCoreLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [ghosttyCoreEnabled, ghosttyScrollbackLimit])

  const useGhosttyCore = ghosttyCoreEnabled && ghosttyCore !== null
  const terminalKey = useGhosttyCore ? 'ghostty' : 'default'

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: chromeBackground }}
    >
      <div
        ref={hostRef}
        className="niozy-terminal-host h-full w-full overflow-hidden [&_.wterm]:!h-full [&_.wterm]:!w-full [&_.wterm]:!rounded-none [&_.wterm]:!p-0 [&_.wterm]:!shadow-none"
      >
        {ghosttyCoreEnabled && ghosttyCoreLoading ? null : (
          <Terminal
            key={terminalKey}
            ref={termRef}
            className="h-full w-full"
            theme={wtermThemeId}
            style={wtermFontStyle}
            core={useGhosttyCore ? ghosttyCore ?? undefined : undefined}
            wasmUrl={useGhosttyCore ? undefined : wtermWasmUrl}
            autoResize
            cursorBlink={cursor.cursorBlink}
            onData={handleData}
            onResize={handleResize}
            onReady={handleReady}
          />
        )}
      </div>
      <SshReconnectHint terminalId={tab.terminalId} />
    </div>
  )
}
