import { writeTerminalInput } from '@/lib/terminal-write'

/** 右键：有选区则复制，无选区则粘贴 */
export function handleTerminalRightClickCopyPaste(
  terminalId: string,
  getSelectionText: () => string,
  event: MouseEvent,
): void {
  event.preventDefault()
  event.stopPropagation()

  const selection = getSelectionText()
  if (selection) {
    void navigator.clipboard.writeText(selection)
    return
  }

  void navigator.clipboard.readText().then((text) => {
    if (text) writeTerminalInput(terminalId, text)
  })
}
