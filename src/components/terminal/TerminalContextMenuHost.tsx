import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/stores/app-store'
import { getCommandReplays } from '@/lib/command-replay'
import { focusTerminal } from '@/lib/terminal-focus'
import { useTerminalUiStore } from '@/stores/terminal-ui-store'
import {
  adjustTerminalFontSizeFromContextMenu,
  addTerminalSelectionToAiSidebarFromContextMenu,
  copyAndPasteToTerminalFromContextMenu,
  copyTerminalSelectionFromContextMenu,
  exportTerminalFromContextMenu,
  openTerminalSearchFromContextMenu,
  pasteToTerminalFromContextMenu,
  replayCommandFromContextMenu,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
} from '@/lib/terminal-context-menu-actions'

export function TerminalContextMenuHost() {
  const { t } = useTranslation()
  const contextMenu = useTerminalUiStore((s) => s.contextMenu)
  const closeContextMenu = useTerminalUiStore((s) => s.closeContextMenu)
  const settings = useAppStore((s) => s.settings)
  const assistive = settings?.assistive
  const commandReplays = getCommandReplays(settings)
  const showCommandReplay = assistive?.commandReplayEnabled !== false
  const showTerminalSearch = assistive?.terminalSearchEnabled !== false
  const fontSize = settings?.terminal.fontSize ?? 13
  const canZoomIn = fontSize < TERMINAL_FONT_SIZE_MAX
  const canZoomOut = fontSize > TERMINAL_FONT_SIZE_MIN
  const aiSidebarEnabled = settings?.experimental.aiSidebarEnabled === true
  const contextTerminalIdRef = useRef<string | null>(null)
  const skipCloseRefocusRef = useRef(false)

  useEffect(() => {
    contextTerminalIdRef.current = contextMenu?.terminalId ?? null
  }, [contextMenu])

  return (
    <DropdownMenu
      open={contextMenu !== null}
      onOpenChange={(open) => {
        if (!open) closeContextMenu()
      }}
      modal
    >
      <DropdownMenuTrigger asChild>
        <span
          style={
            contextMenu
              ? {
                  position: 'fixed',
                  left: contextMenu.x,
                  top: contextMenu.y,
                  width: 0,
                  height: 0,
                  pointerEvents: 'none',
                }
              : { position: 'fixed', left: -9999, top: -9999, width: 0, height: 0 }
          }
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        onCloseAutoFocus={(event) => {
          if (skipCloseRefocusRef.current) {
            skipCloseRefocusRef.current = false
            return
          }
          event.preventDefault()
          const terminalId = contextTerminalIdRef.current
          if (terminalId) focusTerminal(terminalId)
        }}
      >
        <DropdownMenuItem
          disabled={!contextMenu?.hasSelection}
          onSelect={() => void copyTerminalSelectionFromContextMenu()}
        >
          {t('terminal.contextMenu.copy')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void pasteToTerminalFromContextMenu()}>
          {t('terminal.contextMenu.paste')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!contextMenu?.hasSelection}
          onSelect={() => void copyAndPasteToTerminalFromContextMenu()}
        >
          {t('terminal.contextMenu.copyAndPaste')}
        </DropdownMenuItem>
        {aiSidebarEnabled ? (
          <DropdownMenuItem
            disabled={!contextMenu?.hasSelection}
            onSelect={() => {
              skipCloseRefocusRef.current = true
              addTerminalSelectionToAiSidebarFromContextMenu()
            }}
          >
            {t('terminal.contextMenu.addToAiSidebar')}
          </DropdownMenuItem>
        ) : null}
        {showTerminalSearch ? (
          <DropdownMenuItem
            onSelect={() => {
              skipCloseRefocusRef.current = true
              openTerminalSearchFromContextMenu()
            }}
          >
            {t('terminal.contextMenu.search')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => {
            skipCloseRefocusRef.current = true
            void exportTerminalFromContextMenu()
          }}
        >
          {t('terminal.contextMenu.export')}
        </DropdownMenuItem>
        {showCommandReplay ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('terminal.contextMenu.replayList')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {commandReplays.length === 0 ? (
                <DropdownMenuItem disabled>{t('terminal.contextMenu.replayEmpty')}</DropdownMenuItem>
              ) : (
                commandReplays.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => replayCommandFromContextMenu(item.command)}
                  >
                    {item.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('terminal.contextMenu.appearance')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              disabled={!canZoomIn}
              onSelect={() => adjustTerminalFontSizeFromContextMenu(1)}
            >
              {t('terminal.contextMenu.zoomIn')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canZoomOut}
              onSelect={() => adjustTerminalFontSizeFromContextMenu(-1)}
            >
              {t('terminal.contextMenu.zoomOut')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
