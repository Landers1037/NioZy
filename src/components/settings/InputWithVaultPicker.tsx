import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VaultVariablePicker } from './VaultVariablePicker'
import { cn } from '@/lib/utils'

interface InputWithVaultPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  wrapperClassName?: string
  placeholder?: string
  type?: string
}

export function InputWithVaultPicker({
  value,
  onChange,
  className,
  wrapperClassName,
  placeholder,
  type = 'text',
}: InputWithVaultPickerProps) {
  const { t } = useTranslation()
  const [cursor, setCursor] = useState(value.length)
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={cn('flex max-w-md items-center gap-2', wrapperClassName)}>
      <div className="relative min-w-0 flex-1">
        <Input
          type={isPassword && showPassword ? 'text' : type}
          className={cn(className, isPassword && 'pr-9')}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setCursor(e.target.selectionStart ?? e.target.value.length)
            onChange(e.target.value)
          }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyUp={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
        />
        {isPassword && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 size-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={
              showPassword ? t('common.hidePassword') : t('common.showPassword')
            }
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        )}
      </div>
      <VaultVariablePicker
        value={value}
        onChange={onChange}
        selectionStart={cursor}
        onSelectionChange={setCursor}
      />
    </div>
  )
}
