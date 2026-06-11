import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI, isElectron } from '@/lib/electron-client'
import {
  buildPerformanceDegradePatch,
  isPerformanceDegraded,
  RESOURCE_AUTO_DEGRADE_CPU_THRESHOLD,
  sumAppCpuPercent,
} from '@/lib/resource-auto-degrade'

const POLL_MS = 5 * 60 * 1000
const REQUIRED_HIGH_POLLS = 1
const TOAST_COOLDOWN_MS = 5 * 60 * 1000

/**
 * 开启「资源占用自动降级」后，轮询本程序 CPU；
 * 持续过高时在右下角提示，用户可一键切换 DOM 渲染 + Attach-PTY + 非活动 Tab 优化。
 */
export function useResourceAutoDegradeMonitor(): void {
  const { t } = useTranslation()
  const enabled = useAppStore((s) => s.settings?.advanced.resourceAutoDegrade === true)
  const patchSettings = useAppStore((s) => s.patchSettings)

  const highPollCountRef = useRef(0)
  const toastVisibleRef = useRef(false)
  const lastPromptAtRef = useRef(0)
  const activeToastIdRef = useRef<string | number | null>(null)

  useEffect(() => {
    if (!enabled || !isElectron()) {
      highPollCountRef.current = 0
      return
    }

    let cancelled = false

    const applyDegrade = async () => {
      const settings = useAppStore.getState().settings
      if (!settings || isPerformanceDegraded(settings)) return

      try {
        await patchSettings(buildPerformanceDegradePatch(settings))
        toast.success(t('toast.resourceAutoDegradeApplied'))
      } catch {
        toast.error(t('toast.resourceAutoDegradeFailed'))
      } finally {
        toastVisibleRef.current = false
        activeToastIdRef.current = null
        lastPromptAtRef.current = Date.now()
      }
    }

    const showPrompt = (cpuPercent: number) => {
      if (toastVisibleRef.current) return
      if (Date.now() - lastPromptAtRef.current < TOAST_COOLDOWN_MS) return

      toastVisibleRef.current = true
      const id = toast.warning(
        t('toast.resourceAutoDegradePrompt', {
          percent: Math.round(cpuPercent),
          threshold: RESOURCE_AUTO_DEGRADE_CPU_THRESHOLD,
        }),
        {
          duration: 60_000,
          action: {
            label: t('toast.resourceAutoDegradeAction'),
            onClick: () => void applyDegrade(),
          },
          onDismiss: () => {
            toastVisibleRef.current = false
            activeToastIdRef.current = null
            lastPromptAtRef.current = Date.now()
          },
          onAutoClose: () => {
            toastVisibleRef.current = false
            activeToastIdRef.current = null
            lastPromptAtRef.current = Date.now()
          },
        },
      )
      activeToastIdRef.current = id
    }

    const tick = async () => {
      if (cancelled) return

      const settings = useAppStore.getState().settings
      if (!settings?.advanced.resourceAutoDegrade) return
      if (isPerformanceDegraded(settings)) {
        highPollCountRef.current = 0
        return
      }

      try {
        const metrics = await getElectronAPI().system.getAppMetrics()
        if (cancelled) return

        const cpuPercent = sumAppCpuPercent(metrics)
        if (cpuPercent >= RESOURCE_AUTO_DEGRADE_CPU_THRESHOLD) {
          highPollCountRef.current += 1
          if (highPollCountRef.current >= REQUIRED_HIGH_POLLS) {
            showPrompt(cpuPercent)
          }
        } else {
          highPollCountRef.current = 0
        }
      } catch {
        highPollCountRef.current = 0
      }
    }

    void tick()
    const intervalId = window.setInterval(() => void tick(), POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      highPollCountRef.current = 0
      if (activeToastIdRef.current !== null) {
        toast.dismiss(activeToastIdRef.current)
        activeToastIdRef.current = null
      }
      toastVisibleRef.current = false
    }
  }, [enabled, patchSettings, t])
}
