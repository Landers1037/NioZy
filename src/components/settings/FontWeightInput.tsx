import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { SettingField } from './SettingField'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface FontWeightControlProps {
  label: string
  value?: number
  min?: number
  max?: number
  onChange: (value: number | undefined) => void
  className?: string
}

function clampFontWeight(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function FontWeightControl({
  label,
  value,
  min = 100,
  max = 900,
  onChange,
  className,
}: FontWeightControlProps) {
  const { t } = useTranslation()
  const [text, setText] = useState<string>(value === undefined ? '' : String(value))

  useEffect(() => {
    setText(value === undefined ? '' : String(value))
  }, [value])

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={50}
          placeholder={t('settings.fontWeight.defaultPlaceholder')}
          className="max-w-[100px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const raw = text.trim()
            if (!raw) {
              onChange(undefined)
              return
            }
            const n = Number.parseInt(raw, 10)
            if (Number.isNaN(n)) {
              setText(value === undefined ? '' : String(value))
              return
            }
            onChange(clampFontWeight(n, min, max))
          }}
        />
        <span className="shrink-0 text-sm text-muted-foreground">{t('settings.fontWeight.unit')}</span>
      </div>
    </div>
  )
}

interface FontWeightFieldsProps {
  icon: LucideIcon
  regularLabel: string
  boldLabel: string
  regularValue?: number
  boldValue?: number
  onRegularChange: (value: number | undefined) => void
  onBoldChange: (value: number | undefined) => void
  min?: number
  max?: number
}

export function FontWeightFields({
  icon,
  regularLabel,
  boldLabel,
  regularValue,
  boldValue,
  onRegularChange,
  onBoldChange,
  min,
  max,
}: FontWeightFieldsProps) {
  const { t } = useTranslation()

  return (
    <SettingField icon={icon} label={t('settings.fontWeight.title')}>
      <div className="flex flex-wrap items-end gap-6">
        <FontWeightControl
          label={regularLabel}
          value={regularValue}
          min={min}
          max={max}
          onChange={onRegularChange}
        />
        <FontWeightControl
          label={boldLabel}
          value={boldValue}
          min={min}
          max={max}
          onChange={onBoldChange}
        />
      </div>
    </SettingField>
  )
}
