import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, FolderOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VaultVariablePicker } from './VaultVariablePicker'
import { cn } from '@/lib/utils'

interface InputWithVaultPickerProps {
  value: string
  onChange: (value: string) => void
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  /** 通过存储库按钮插入 ${VAR} 后调用 */
  onAfterVaultInsert?: (value: string) => void
  className?: string
  wrapperClassName?: string
  placeholder?: string
  type?: string
  /** 在输入框右侧显示「浏览文件」按钮（用于私钥路径等） */
  showFileBrowse?: boolean
  onFileBrowse?: () => void
  fileBrowseAriaLabel?: string
}

export function InputWithVaultPicker({
  value,
  onChange,
  onFocus,
  onBlur,
  onAfterVaultInsert,
  className,
  wrapperClassName,
  placeholder,
  type = 'text',
  showFileBrowse,
  onFileBrowse,
  fileBrowseAriaLabel,
}: InputWithVaultPickerProps) {
  const { t } = useTranslation()
  const [cursor, setCursor] = useState(value.length)
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const rootRef = useRef<HTMLDivElement>(null)

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    const related = e.relatedTarget as Node | null
    if (related && rootRef.current?.contains(related)) return
    onBlur?.(e)
  }

  return (
    <div ref={rootRef} className={cn('flex max-w-md items-center gap-2', wrapperClassName)}>
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
          onFocus={onFocus}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyUp={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onBlur={handleBlur}
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
      {showFileBrowse && onFileBrowse && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={fileBrowseAriaLabel}
          onClick={onFileBrowse}
        >
          <FolderOpen className="size-4" />
        </Button>
      )}
      <VaultVariablePicker
        value={value}
        onChange={onChange}
        selectionStart={cursor}
        onSelectionChange={setCursor}
        onAfterInsert={onAfterVaultInsert}
      />
    </div>
  )
}
