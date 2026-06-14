const COPILOT_CHAT_TEXTAREA_SELECTOR =
  '[data-copilot-sidebar] [data-testid="copilot-chat-textarea"]'

function getCopilotChatTextarea(): HTMLTextAreaElement | null {
  return document.querySelector(COPILOT_CHAT_TEXTAREA_SELECTOR)
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
  descriptor?.set?.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Append text to CopilotKit chat input; syncs React state via native input event. */
export function appendCopilotChatInput(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  const textarea = getCopilotChatTextarea()
  if (!textarea) return false

  const current = textarea.value
  const next =
    current.length === 0 ? trimmed : `${current.replace(/\n$/, '')}\n${trimmed}`

  setTextareaValue(textarea, next)
  textarea.focus({ preventScroll: true })
  return true
}
