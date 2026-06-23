import type { AppSettings } from '../../electron/shared/api-types'

/** 用户设置中是否启用了 WebGPU（须同时开启硬件加速） */
export function isWebGpuEnabledInSettings(settings: AppSettings | null | undefined): boolean {
  return (
    settings?.advanced.hardwareAcceleration === true &&
    settings?.advanced.webGpuAcceleration === true
  )
}

let cachedProbe: Promise<boolean> | null = null

/** 探测当前 Chromium 运行时是否可用 WebGPU adapter */
export function probeWebGpuRuntime(): Promise<boolean> {
  if (cachedProbe) return cachedProbe
  cachedProbe = (async () => {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false
    }
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> }
    }).gpu
    if (!gpu) return false
    try {
      const adapter = await gpu.requestAdapter()
      return adapter !== null
    } catch {
      return false
    }
  })()
  return cachedProbe
}
