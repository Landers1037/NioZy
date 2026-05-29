import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getElectronAPI } from '@/lib/electron-client'
import { insertVaultReference } from '@/lib/vault-reference'
import { toast } from 'sonner'

interface VaultVariablePickerProps {
  value: string
  onChange: (value: string) => void
  /** 可选：受控光标位置；未提供时在末尾插入 */
  selectionStart?: number
  onSelectionChange?: (start: number) => void
  /** 插入变量引用后触发（用于立即持久化，避免仅 blur 保存） */
  onAfterInsert?: (value: string) => void
}

export function VaultVariablePicker({
  value,
  onChange,
  selectionStart,
  onSelectionChange,
  onAfterInsert,
}: VaultVariablePickerProps) {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const loadKeys = async () => {
    setLoading(true)
    try {
      const list = await getElectronAPI().vault.getKeys()
      setKeys(list)
      if (list.length === 0) toast.message(t('settings.vault.vaultEmpty'))
    } catch {
      toast.error(t('settings.vault.vaultLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const pick = (key: string) => {
    const pos = selectionStart ?? value.length
    const next = insertVaultReference(value, key, pos)
    onChange(next)
    onAfterInsert?.(next)
    const newPos = pos + key.length + 3
    onSelectionChange?.(newPos)
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadKeys()}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          title={t('settings.vault.insertVaultVar')}
          disabled={loading}
        >
          <Database className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
        {keys.length === 0 && (
          <DropdownMenuItem disabled>{t('settings.vault.noVariables')}</DropdownMenuItem>
        )}
        {keys.map((key) => (
          <DropdownMenuItem key={key} onClick={() => pick(key)}>
            <code className="text-xs">{`\${${key}}`}</code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
