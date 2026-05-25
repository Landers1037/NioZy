/** 自动滚到底时额外留出的底部空隙（与终端 Tab 外边距 p-[10px] 对齐） */
export const WTERM_SCROLL_BOTTOM_EXTRA_PX = 10

export function wtermMaxScrollTop(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

/** 用户是否在底部跟随输出（容差约一行，兼容 wterm 按行对齐的 scrollTop） */
export function isWtermNearBottom(element: HTMLElement, thresholdPx = 24): boolean {
  return (
    wtermMaxScrollTop(element) - element.scrollTop <=
    thresholdPx + WTERM_SCROLL_BOTTOM_EXTRA_PX
  )
}

/**
 * 滚到真实底部。已在底部时不改 scrollTop，避免每输入一字就触发滚动跳动。
 */
export function scrollWtermToBottom(element: HTMLElement): void {
  const maxScroll = wtermMaxScrollTop(element)
  if (maxScroll - element.scrollTop <= 1) return
  element.scrollTop = maxScroll
}

/** 仅在内容变高且用户本来在底部时跟随（避免逐字回显时反复 scroll） */
export function queueWtermScrollToBottom(
  element: HTMLElement | null | undefined,
  options?: { force?: boolean },
): void {
  if (!element) return
  const force = options?.force ?? false
  const scrollHeightBefore = element.scrollHeight

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const grew = element.scrollHeight > scrollHeightBefore
      const follow = force || (grew && isWtermNearBottom(element))
      if (follow) scrollWtermToBottom(element)
    })
  })
}
