export function formatStatusBarDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatStatusBarTime(d: Date): string {
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}
