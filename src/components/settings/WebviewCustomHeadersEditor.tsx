import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WebviewCustomHeader } from '../../../electron/shared/webview-preview'
import { MAX_WEBVIEW_CUSTOM_HEADERS } from '../../../electron/shared/webview-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface WebviewCustomHeadersEditorProps {
  headers: WebviewCustomHeader[]
  onChange: (headers: WebviewCustomHeader[]) => void
}

export function WebviewCustomHeadersEditor({
  headers,
  onChange,
}: WebviewCustomHeadersEditorProps) {
  const { t } = useTranslation()

  const updateRow = (index: number, patch: Partial<WebviewCustomHeader>): void => {
    onChange(headers.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number): void => {
    onChange(headers.filter((_, i) => i !== index))
  }

  const addRow = (): void => {
    if (headers.length >= MAX_WEBVIEW_CUSTOM_HEADERS) return
    onChange([...headers, { name: '', value: '' }])
  }

  return (
    <div className="flex flex-col gap-2">
      {headers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('settings.preview.webviewHeadersEmpty')}
        </p>
      ) : (
        headers.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              className="h-8 min-w-0 flex-1 font-mono text-xs"
              placeholder={t('settings.preview.webviewHeaderNamePlaceholder')}
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <Input
              className="h-8 min-w-0 flex-[1.5] font-mono text-xs"
              placeholder={t('settings.preview.webviewHeaderValuePlaceholder')}
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={t('settings.preview.webviewHeaderRemove')}
              onClick={() => removeRow(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={headers.length >= MAX_WEBVIEW_CUSTOM_HEADERS}
        onClick={addRow}
      >
        <Plus className="size-3.5" />
        {t('settings.preview.webviewHeaderAdd')}
      </Button>
    </div>
  )
}
