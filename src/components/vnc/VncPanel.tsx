import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'
import {
  applyVncRfbExperimentalOptions,
  applyVncViewportOptions,
  installVncCanvasAccelHints,
} from '@/lib/vnc-rfb-config'

type RfbModule = typeof import('@novnc/novnc')

export function VncPanel({ tabId, connectionId }: { tabId: string; connectionId: string }) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<InstanceType<RfbModule['default']> | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const experimental = settings?.experimental
  const vncAdaptiveScale = experimental?.vncAdaptiveScale !== false
  const vncHardwareAccel = experimental?.vncHardwareAccel === true
  const vncLocalCursor = experimental?.vncLocalCursor !== false
  const vncEncoding = experimental?.vncEncoding ?? 'tight'

  const conn = useMemo(() => {
    const c = settings?.connections.find((c) => c.id === connectionId)
    return c?.type === 'vnc' ? c : null
  }, [settings?.connections, connectionId])

  useEffect(() => {
    let cancelled = false
    let removeCanvasAccel: (() => void) | undefined
    const api = getElectronAPI()

    const cleanup = async () => {
      const rfb = rfbRef.current
      rfbRef.current = null
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      try {
        rfb?.disconnect()
      } catch {
        // ignore
      }
      try {
        await api.vnc.stopProxy({ tabId })
      } catch {
        // ignore
      }
      removeCanvasAccel?.()
      removeCanvasAccel = undefined
    }

    if (!experimental?.vncWebEnabled) {
      setStatus('idle')
      setError(null)
      void cleanup()
      return
    }

    if (!conn) {
      setStatus('error')
      setError('VNC_CONNECTION_NOT_FOUND')
      void cleanup()
      return
    }

    if (!containerRef.current) return

    setStatus('connecting')
    setError(null)

    void (async () => {
      await cleanup()
      if (cancelled) return

      const host = (conn.vncHost ?? conn.command).trim()
      const port = conn.vncPort ?? 5900
      const usernameRaw = conn.vncUsername ?? ''
      const passwordRaw = conn.vncPassword ?? ''

      const [username, password] = await Promise.all([
        usernameRaw ? api.vault.resolve(usernameRaw) : Promise.resolve(''),
        passwordRaw ? api.vault.resolve(passwordRaw) : Promise.resolve(''),
      ])
      if (cancelled) return

      const { wsUrl } = await api.vnc.startProxy({ tabId, host, port })
      if (cancelled) return

      const el = containerRef.current
      if (!el) return

      if (vncHardwareAccel) {
        removeCanvasAccel = installVncCanvasAccelHints()
      }

      const mod = (await import('@novnc/novnc')) as RfbModule
      if (cancelled) return

      const RFB = mod.default
      const rfb = new RFB(el, wsUrl, {
        credentials: {
          username,
          password,
        },
      })
      rfbRef.current = rfb

      applyVncRfbExperimentalOptions(rfb, {
        hardwareAccel: vncHardwareAccel,
        localCursor: vncLocalCursor,
        encoding: vncEncoding,
      })
      applyVncViewportOptions(rfb, vncAdaptiveScale)

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          const rfbLive = rfbRef.current
          if (!rfbLive) return
          try {
            applyVncViewportOptions(rfbLive, vncAdaptiveScale)
          } catch {
            // ignore
          }
        })
        ro.observe(el)
        resizeObserverRef.current = ro
      }

      rfb.addEventListener('connect', () => {
        if (cancelled) return
        setStatus('connected')
      })
      rfb.addEventListener('disconnect', (ev: unknown) => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clean = (ev as any)?.detail?.clean
        if (clean) {
          setStatus('idle')
          setError(null)
        } else {
          setStatus('error')
          setError('VNC_DISCONNECTED')
        }
      })
      rfb.addEventListener('securityfailure', () => {
        if (cancelled) return
        setStatus('error')
        setError('VNC_SECURITY_FAILURE')
      })
      rfb.addEventListener('credentialsrequired', () => {
        try {
          // noVNC may ask again depending on security type
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(rfb as any).sendCredentials({ username, password })
        } catch {
          // ignore
        }
      })
    })().catch((e) => {
      if (cancelled) return
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    })

    return () => {
      cancelled = true
      void cleanup()
    }
  }, [
    conn,
    experimental?.vncWebEnabled,
    tabId,
    vncAdaptiveScale,
    vncEncoding,
    vncHardwareAccel,
    vncLocalCursor,
  ])

  const hint = (() => {
    if (!experimental?.vncWebEnabled) return t('settings.experimental.vncWebEnabledDesc')
    if (status === 'connecting') return t('common.loading')
    if (status === 'error') return error ?? 'VNC_ERROR'
    return null
  })()

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-background">
      <div
        ref={containerRef}
        className={cn('absolute inset-0', status !== 'connected' && 'opacity-0')}
      />
      {hint && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          <span className="max-w-[680px] break-words">{hint}</span>
        </div>
      )}
    </div>
  )
}
