import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BatteryCharging } from 'lucide-react'
import { getBatteryIconColor, getBatteryTagClassName } from '@/lib/battery-status'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '../../../electron/shared/api-types'
import type { UiStyle } from '../../../electron/shared/ui-style'

function BatteryLevelIcon({
  percent,
  className,
}: {
  percent: number
  className?: string
}) {
  const color = getBatteryIconColor(percent)
  const bodyW = 21.5
  const bodyH = 14
  const bodyX = 1.25
  const bodyY = (24 - bodyH) / 2
  const cornerR = 2
  const terminalW = 2.2
  const terminalH = bodyH * 0.42
  const terminalX = bodyX + bodyW
  const terminalY = bodyY + (bodyH - terminalH) / 2
  const bodyRight = bodyX + bodyW
  const innerPad = 1.75
  const innerX = bodyX + innerPad
  const innerY = bodyY + innerPad
  const innerW = bodyW - innerPad * 2
  const innerH = bodyH - innerPad * 2
  const fillWidth = innerW * (percent / 100)
  const outlinePath = [
    `M ${bodyX + cornerR} ${bodyY}`,
    `H ${bodyRight}`,
    `V ${bodyY + bodyH}`,
    `H ${bodyX + cornerR}`,
    `Q ${bodyX} ${bodyY + bodyH} ${bodyX} ${bodyY + bodyH - cornerR}`,
    `V ${bodyY + cornerR}`,
    `Q ${bodyX} ${bodyY} ${bodyX + cornerR} ${bodyY}`,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox="0 0 26 24"
      className={cn('size-4 shrink-0 block self-center', className)}
      aria-hidden
    >
      <path
        d={outlinePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect
        x={terminalX}
        y={terminalY}
        width={terminalW}
        height={terminalH}
        rx={0.6}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {fillWidth > 0 ? (
        <rect x={innerX} y={innerY} width={fillWidth} height={innerH} rx={1.1} fill={color} />
      ) : null}
    </svg>
  )
}

function BatteryStatusContent({
  percent,
  isCharging,
}: {
  percent: number
  isCharging: boolean
}) {
  const { t } = useTranslation()

  return (
    <span className="inline-flex items-center gap-1 leading-none">
      {isCharging ? (
        <BatteryCharging
          className="size-4 shrink-0 self-center"
          style={{ color: getBatteryIconColor(percent) }}
          aria-hidden
        />
      ) : null}
      <BatteryLevelIcon percent={percent} />
      <span className="leading-none">{t('statusBar.battery', { percent })}</span>
    </span>
  )
}

export const BatteryStatusIndicator = memo(function BatteryStatusIndicator({
  percent,
  isCharging,
  theme,
  uiStyle,
  isClassic,
  fieldClass,
  renderTag,
}: {
  percent: number
  isCharging: boolean
  theme: ThemeMode
  uiStyle: UiStyle
  isClassic: boolean
  fieldClass: string
  renderTag: (content: ReactNode, className?: string) => ReactNode
}) {
  const { t } = useTranslation()
  const isDark = theme === 'dark'
  const coloredTags = uiStyle === 'niozy' || uiStyle === 'cyberpunk' || uiStyle === 'glass'
  const title = isCharging
    ? t('statusBar.batteryTitleCharging', { percent })
    : t('statusBar.batteryTitle', { percent })
  const content = <BatteryStatusContent percent={percent} isCharging={isCharging} />

  if (coloredTags) {
    return (
      <span
        title={title}
        className={cn(
          'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight',
          getBatteryTagClassName(percent, isDark),
        )}
      >
        {content}
      </span>
    )
  }

  if (isClassic) {
    return (
      <span
        title={title}
        className={cn(
          'inline-flex max-w-full min-h-[18px] items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
          getBatteryTagClassName(percent, isDark),
          fieldClass,
        )}
      >
        {content}
      </span>
    )
  }

  return renderTag(
    <span title={title} className="inline-flex items-center gap-1">
      {content}
    </span>,
    cn('shrink-0', getBatteryTagClassName(percent, isDark)),
  )
})
