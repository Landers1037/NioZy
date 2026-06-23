/** Radix modal 层全部关闭后，清理 react-remove-scroll 残留在 body 上的锁。 */
export function releaseStuckBodyScrollLockIfIdle(): void {
  const openOverlays = document.querySelectorAll(
    [
      '[data-state="open"][role="dialog"]',
      '[data-state="open"][role="alertdialog"]',
      '[data-state="open"][role="menu"]',
    ].join(', '),
  )
  if (openOverlays.length > 0) return

  document.body.style.removeProperty('pointer-events')
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('padding-right')
  document.body.style.removeProperty('margin-right')
}

/** 在下一帧检查并释放卡住的 body scroll lock（供弹框卸载后调用）。 */
export function scheduleReleaseStuckBodyScrollLock(): void {
  window.requestAnimationFrame(() => {
    releaseStuckBodyScrollLockIfIdle()
  })
}
