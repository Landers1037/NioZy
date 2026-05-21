import { useState } from 'react'
import { Input } from '@/components/ui/input'
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
  const [cursor, setCursor] = useState(value.length)

  return (
    <div className={cn('flex max-w-md items-center gap-2', wrapperClassName)}>
      <Input
        type={type}
        className={className}
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
      <VaultVariablePicker
        value={value}
        onChange={onChange}
        selectionStart={cursor}
        onSelectionChange={setCursor}
      />
    </div>
  )
}
