import { useEffect, useMemo, useState } from 'react'
import { formatStatusBarDate, formatStatusBarTime } from '@/lib/status-bar-clock'

/** 状态栏日期/时间：渲染进程本地时钟，每秒刷新，不跟随系统指标轮询优先级 */
export function useStatusBarClock(enabled: boolean): { date: string; time: string } {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) return
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [enabled])

  return useMemo(
    () => ({
      date: formatStatusBarDate(now),
      time: formatStatusBarTime(now),
    }),
    [now],
  )
}
