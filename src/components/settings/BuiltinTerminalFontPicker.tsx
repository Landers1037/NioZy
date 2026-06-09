import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TERMINAL_BUILTIN_FONT_OPTIONS,
  getTerminalBuiltinFontFamily,
  type TerminalBuiltinFontId,
} from '../../../electron/shared/terminal-builtin-fonts'
import { cn } from '@/lib/utils'

interface BuiltinTerminalFontPickerProps {
  value: TerminalBuiltinFontId
  onChange: (value: TerminalBuiltinFontId) => void
  className?: string
}

export function BuiltinTerminalFontPicker({
  value,
  onChange,
  className,
}: BuiltinTerminalFontPickerProps) {
  const selected = TERMINAL_BUILTIN_FONT_OPTIONS.find((opt) => opt.id === value)

  return (
    <Select value={value} onValueChange={(v) => onChange(v as TerminalBuiltinFontId)}>
      <SelectTrigger className={cn('max-w-xs', className)}>
        <SelectValue>
          <span
            className="truncate font-mono"
            style={{ fontFamily: selected ? getTerminalBuiltinFontFamily(selected.id) : undefined }}
          >
            {selected?.label ?? value}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TERMINAL_BUILTIN_FONT_OPTIONS.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            <span className="font-mono" style={{ fontFamily: getTerminalBuiltinFontFamily(opt.id) }}>
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
