import { useTranslation } from 'react-i18next'
import { FilePlus, FolderOpen, Save, SaveAll } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DrawingFileToolbarProps {
  filePath: string | null
  dirty: boolean
  disabled?: boolean
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

export function DrawingFileToolbar({
  filePath,
  dirty,
  disabled = false,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: DrawingFileToolbarProps) {
  const { t } = useTranslation()
  const fileLabel = filePath
    ? filePath.split(/[/\\]/).pop() ?? filePath
    : t('drawing.unsaved')

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onNew}
        >
          <FilePlus className="size-4" />
          {t('drawing.new')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onOpen}
        >
          <FolderOpen className="size-4" />
          {t('drawing.open')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !dirty}
          onClick={onSave}
        >
          <Save className="size-4" />
          {t('drawing.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onSaveAs}
        >
          <SaveAll className="size-4" />
          {t('drawing.saveAs')}
        </Button>
      </div>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs text-muted-foreground',
          dirty && 'text-foreground',
        )}
        title={filePath ?? undefined}
      >
        {fileLabel}
        {dirty ? ` (${t('drawing.modified')})` : ''}
      </span>
    </div>
  )
}
