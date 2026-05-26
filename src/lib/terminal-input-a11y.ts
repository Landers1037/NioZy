const PATCHED_ATTR = 'data-niozy-input-a11y'

/** @wterm/dom 离屏 textarea 或 xterm helper textarea */
function isTerminalCaptureTextarea(el: HTMLTextAreaElement): boolean {
  return (
    el.classList.contains('xterm-helper-textarea') ||
    el.getAttribute('enterkeyhint') === 'send'
  )
}

export function patchTerminalInputA11y(
  textarea: HTMLTextAreaElement,
  label: string,
): void {
  if (textarea.getAttribute(PATCHED_ATTR) === 'true') {
    if (textarea.getAttribute('aria-hidden') === 'true') {
      textarea.removeAttribute('aria-hidden')
    }
    return
  }
  textarea.removeAttribute('aria-hidden')
  textarea.setAttribute('aria-label', label)
  textarea.setAttribute(PATCHED_ATTR, 'true')
}

export function observeTerminalInputA11y(
  root: HTMLElement,
  label: string,
): () => void {
  const patchAll = () => {
    root.querySelectorAll('textarea').forEach((node) => {
      if (node instanceof HTMLTextAreaElement && isTerminalCaptureTextarea(node)) {
        patchTerminalInputA11y(node, label)
      }
    })
  }

  patchAll()

  const observer = new MutationObserver(patchAll)
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-hidden'],
  })

  return () => observer.disconnect()
}
