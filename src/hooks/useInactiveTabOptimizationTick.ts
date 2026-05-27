import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'

/** 非活动 Tab 优化开启时定期刷新，以便在 5 分钟空闲后触发卸载。 */
export function useInactiveTabOptimizationTick(): number {
  const enabled = useAppStore((s) => s.settings?.shell.inactiveTabOptimization === true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [enabled])

  return tick
}
