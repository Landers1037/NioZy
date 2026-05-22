import { Input } from '@/components/ui/input'
import { keyboardEventToAccelerator } from '@/lib/shortcut-utils'
import { useTranslation } from 'react-i18next'

/** 用于编辑/清空输入，不作为快捷键录制 */
const SKIP_RECORD_KEYS = new Set(['Backspace', 'Delete'])

type ShortcutInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  validate?: (value: string) => boolean
  onInvalid?: () => void
}

export function ShortcutInput({
  value,
  onChange,
  className,
  validate,
  onInvalid,
}: ShortcutInputProps) {
  const { t } = useTranslation()
  const isEmpty = !value.trim()

  const commitRecorded = (next: string) => {
    if (validate && !validate(next)) {
      onInvalid?.()
      return
    }
    onChange(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (SKIP_RECORD_KEYS.has(e.key)) return
    if (!isEmpty) return
    const accelerator = keyboardEventToAccelerator(e.nativeEvent)
    if (!accelerator) return
    e.preventDefault()
    commitRecorded(accelerator)
  }

  const handleBlur = () => {
    if (!validate || validate(value)) return
    onInvalid?.()
  }

  return (
    <Input
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={validate ? handleBlur : undefined}
      placeholder={isEmpty ? t('settings.shortcuts.pressToRecord') : undefined}
    />
  )
}
