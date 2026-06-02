import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'

type RfbModule = typeof import('@novnc/novnc')

export function VncPanel({ tabId, connectionId }: { tabId: string; connectionId: string }) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<InstanceType<RfbModule['default']> | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const conn = useMemo(() => {
    const c = settings?.connections.find((c) => c.id === connectionId)
    return c?.type === 'vnc' ? c : null
  }, [settings?.connections, connectionId])

  useEffect(() => {
    let cancelled = false
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
    }

    if (!settings?.experimental.vncWebEnabled) {
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

      const adaptiveScale = settings?.experimental.vncAdaptiveScale !== false
      // scaleViewport: scale-to-fit inside container; clipViewport: allow panning when not scaling
      rfb.scaleViewport = adaptiveScale
      rfb.clipViewport = !adaptiveScale
      // default: do not change remote resolution automatically
      rfb.resizeSession = false

      // When container size changes (window resize, sidebar resize), re-apply scaling flags.
      // noVNC reacts internally, but this ensures toggles take effect immediately.
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          const nextAdaptive = settings?.experimental.vncAdaptiveScale !== false
          try {
            rfb.scaleViewport = nextAdaptive
            rfb.clipViewport = !nextAdaptive
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
  }, [settings?.experimental.vncWebEnabled, settings?.experimental.vncAdaptiveScale, conn, tabId])

  const hint = (() => {
    if (!settings?.experimental.vncWebEnabled) return t('settings.experimental.vncWebEnabledDesc')
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

