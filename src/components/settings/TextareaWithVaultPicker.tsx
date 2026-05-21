import { useState } from 'react'
import { VaultVariablePicker } from './VaultVariablePicker'
import { cn } from '@/lib/utils'

interface TextareaWithVaultPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export function TextareaWithVaultPicker({
  value,
  onChange,
  className,
  placeholder,
}: TextareaWithVaultPickerProps) {
  const [cursor, setCursor] = useState(value.length)

  return (
    <div className="flex gap-2">
      <textarea
        className={cn(
          'min-h-[80px] flex-1 rounded-lg border border-border bg-muted p-2 text-sm',
          className,
        )}
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
