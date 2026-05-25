import { useEffect, useCallback, useRef } from 'react'
import { Terminal, useTerminal } from '@wterm/react'
import type { WTerm } from '@wterm/dom'
import '@wterm/react/css'
import wtermWasmUrl from '@wterm/core/wasm?url'
import { useAppStore } from '@/stores/app-store'
import { resolveTerminalTheme } from '@/lib/terminal-themes'
import { buildWtermThemeStyle } from '@/lib/wterm-theme'
import { getElectronAPI } from '@/lib/electron-client'
import { getTerminalCursorOptions } from '@/lib/terminal-cursor'
import { attachWtermDomShellFeatures } from '@/lib/wterm-dom-shell'
import { DEFAULT_SHELL_SETTINGS } from '../../../electron/shared/shell-settings'
import i18n from '@/lib/i18n'
import { queueWtermScrollToBottom } from '@/lib/wterm-scroll'
import type { TerminalViewProps } from './terminal-view-props'

export function WterminalView({ tab, isFocused = false }: TerminalViewProps) {
  const { ref: termRef, write, focus } = useTerminal()
  const settings = useAppStore((s) => s.settings)
  const shellCleanupRef = useRef<(() => void) | null>(null)

  const terminalBackground =
    resolveTerminalTheme(settings?.terminal.colorScheme ?? 'atom').background ?? '#101419'

  const wtermStyle = settings
    ? buildWtermThemeStyle(
        resolveTerminalTheme(settings.terminal.colorScheme),
        settings.terminal.fontFamily,
        settings.terminal.fontSize,
      )
    : undefined

  const cursor = settings ? getTerminalCursorOptions(settings.terminal) : { cursorBlink: true }

  const detachShellFeatures = useCallback(() => {
    shellCleanupRef.current?.()
    shellCleanupRef.current = null
  }, [])

  const attachShellFeatures = useCallback(
    (instance: WTerm) => {
      detachShellFeatures()
      if (!tab.terminalId || !settings) return
      shellCleanupRef.current = attachWtermDomShellFeatures(instance, {
        terminalId: tab.terminalId,
        rightClickCopyPaste: settings.terminal.rightClickCopyPaste,
        shell: settings.shell ?? DEFAULT_SHELL_SETTINGS,
      })
    },
    [tab.terminalId, settings, detachShellFeatures],
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
        const msg =
          code !== 0
            ? i18n.t('terminal.processExitedWithCode', { code })
            : i18n.t('terminal.processExited')
        write(`\r\n\x1b[33m${msg}\x1b[0m\r\n`)
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
    settings?.shell?.highlightLinks,
    settings?.shell?.clickToOpenLinks,
    settings?.shell?.shiftEnterNewline,
    attachShellFeatures,
    termRef,
  ])

  useEffect(() => {
    if (isFocused) {
      focus()
    }
  }, [isFocused, focus])

  const handleData = useCallback(
    (data: string) => {
      if (!tab.terminalId) return
      getElectronAPI().terminal.write(tab.terminalId, data)
    },
    [tab.terminalId],
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
    },
    [attachShellFeatures, isFocused, focus],
  )

  return (
    <div
      className="absolute inset-0 overflow-hidden p-[10px]"
      style={{ backgroundColor: terminalBackground }}
    >
      <div
        className="niozy-terminal-host h-full w-full overflow-hidden [&_.wterm]:!h-full [&_.wterm]:!w-full [&_.wterm]:!rounded-none [&_.wterm]:!p-0 [&_.wterm]:!shadow-none"
        style={wtermStyle}
      >
        <Terminal
          ref={termRef}
          className="h-full w-full"
          wasmUrl={wtermWasmUrl}
          autoResize
          cursorBlink={cursor.cursorBlink}
          onData={handleData}
          onResize={handleResize}
          onReady={handleReady}
        />
      </div>
    </div>
  )
}
