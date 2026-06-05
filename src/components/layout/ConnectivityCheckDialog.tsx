import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'
import type {
  ConnectivityCheckMethod,
  ConnectivityCheckResult,
  ConnectivityProtocol,
  TcpCheckMethod,
  UdpCheckMethod,
} from '../../../electron/shared/connectivity-check-types'
import {
  TCP_CHECK_METHODS,
  UDP_CHECK_METHODS,
} from '../../../electron/shared/connectivity-check-types'

const DEFAULT_PORT = '443'

function defaultMethod(protocol: ConnectivityProtocol): ConnectivityCheckMethod {
  return protocol === 'tcp' ? 'socket_connect' : 'udp_send'
}

export function ConnectivityCheckDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [protocol, setProtocol] = useState<ConnectivityProtocol>('tcp')
  const [method, setMethod] = useState<ConnectivityCheckMethod>('socket_connect')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState(DEFAULT_PORT)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ConnectivityCheckResult | null>(null)

  const methods = useMemo(
    () => (protocol === 'tcp' ? TCP_CHECK_METHODS : UDP_CHECK_METHODS),
    [protocol],
  )

  const portDisabled = method === 'icmp_ping'

  useEffect(() => {
    if (!methods.includes(method as TcpCheckMethod & UdpCheckMethod)) {
      setMethod(defaultMethod(protocol))
    }
  }, [protocol, methods, method])

  useEffect(() => {
    if (!open) {
      setResult(null)
      setRunning(false)
    }
  }, [open])

  const methodLabel = (value: ConnectivityCheckMethod) =>
    t(`titleBar.connectivityCheckMethod.${value}`)

  const handleProtocolChange = (next: ConnectivityProtocol) => {
    setProtocol(next)
    setMethod(defaultMethod(next))
    setResult(null)
  }

  const handleRun = async () => {
    const parsedPort = Number.parseInt(port, 10)
    setRunning(true)
    setResult(null)
    try {
      const res = await getElectronAPI().connectivity.check({
        protocol,
        method,
        host: host.trim(),
        port: parsedPort,
      })
      setResult(res)
    } catch (err) {
      setResult({
        ok: false,
        reachable: false,
        message: t('titleBar.connectivityCheckError'),
        detail: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>{t('titleBar.connectivityCheckTitle')}</DialogTitle>
          <DialogDescription>{t('titleBar.connectivityCheckDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="connectivity-protocol">{t('titleBar.connectivityCheckProtocol')}</Label>
              <Select value={protocol} onValueChange={(v) => handleProtocolChange(v as ConnectivityProtocol)}>
                <SelectTrigger id="connectivity-protocol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">{t('titleBar.connectivityCheckProtocolTcp')}</SelectItem>
                  <SelectItem value="udp">{t('titleBar.connectivityCheckProtocolUdp')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="connectivity-method">{t('titleBar.connectivityCheckMethodLabel')}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as ConnectivityCheckMethod)}>
                <SelectTrigger id="connectivity-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((item) => (
                    <SelectItem key={item} value={item}>
                      {methodLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="connectivity-host">{t('titleBar.connectivityCheckHost')}</Label>
              <Input
                id="connectivity-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="connectivity-port">{t('titleBar.connectivityCheckPort')}</Label>
              <Input
                id="connectivity-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                disabled={portDisabled}
                onChange={(e) => setPort(e.target.value)}
                placeholder="443"
              />
            </div>
          </div>

          {portDisabled ? (
            <p className="text-xs text-muted-foreground">
              {t('titleBar.connectivityCheckPortIcmpHint')}
            </p>
          ) : null}
        </div>

        {result ? (
          <div
            className={cn(
              'mt-4 rounded-lg border px-3 py-2 text-sm',
              result.reachable
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
          >
            <div className="font-medium">
              {result.reachable
                ? t('titleBar.connectivityCheckSuccess')
                : t('titleBar.connectivityCheckFailed')}
              {typeof result.latencyMs === 'number'
                ? ` · ${result.latencyMs} ms`
                : null}
            </div>
            <div className="mt-1 text-xs opacity-90">{result.message}</div>
            {result.detail ? (
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] opacity-80">
                {result.detail}
              </pre>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => void handleRun()} disabled={running || !host.trim()}>
            {running ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                {t('titleBar.connectivityCheckRunning')}
              </>
            ) : (
              t('titleBar.connectivityCheckRun')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
