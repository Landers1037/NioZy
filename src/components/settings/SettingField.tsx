import type { LucideIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SettingFieldProps {
  icon: LucideIcon
  label: string
  description?: string
  children?: React.ReactNode
  className?: string
  /** 横向布局（开关类） */
  row?: boolean
}

export function SettingField({
  icon: Icon,
  label,
  description,
  children,
  className,
  row,
}: SettingFieldProps) {
  const labelBlock = (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <Label className="text-sm font-semibold leading-none">{label}</Label>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )

  if (row) {
    return (
      <div className={cn('flex items-center justify-between gap-4 max-w-md', className)}>
        {labelBlock}
        {children}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {labelBlock}
      {children}
    </div>
  )
}
