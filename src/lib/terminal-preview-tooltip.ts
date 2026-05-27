let tooltipEl: HTMLDivElement | null = null

function ensureTooltip(): HTMLDivElement {
  if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl
  tooltipEl = document.createElement('div')
  tooltipEl.className =
    'pointer-events-none fixed z-[100] rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md'
  tooltipEl.style.display = 'none'
  document.body.appendChild(tooltipEl)
  return tooltipEl
}

export function showTerminalPreviewTooltip(clientX: number, clientY: number, text: string): void {
  const el = ensureTooltip()
  el.textContent = text
  el.style.display = 'block'
  el.style.left = `${clientX + 12}px`
  el.style.top = `${clientY + 12}px`
}

export function hideTerminalPreviewTooltip(): void {
  if (!tooltipEl) return
  tooltipEl.style.display = 'none'
}
