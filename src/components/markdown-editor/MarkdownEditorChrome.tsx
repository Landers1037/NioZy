import { useTranslation } from 'react-i18next'
import {
  Copy,
  FilePlus,
  FolderOpen,
  MoreHorizontal,
  Save,
  SaveAll,
  FileCode2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { markdownToPlainHtmlDocument } from './render/markdown-pipeline'
import { cn } from '@/lib/utils'

interface MarkdownEditorChromeProps {
  isWysiwyg: boolean
  onWysiwygChange: (enabled: boolean) => void
  dirty: boolean
  fileName: string
  content: string
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  disabled?: boolean
}

export function MarkdownEditorChrome({
  isWysiwyg,
  onWysiwygChange,
  dirty,
  fileName,
  content,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  disabled = false,
}: MarkdownEditorChromeProps) {
  const { t } = useTranslation()

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success(t('markdownEditor.copySuccess'))
    } catch {
      toast.error(t('markdownEditor.copyFailed'))
    }
  }

  const exportHtml = () => {
    const html = markdownToPlainHtmlDocument(content, fileName)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace(/\.md$/i, '') || 'document'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn('markdown-editor-chrome no-drag')}>
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1 shadow-sm backdrop-blur-sm">
        <Switch
          checked={isWysiwyg}
          onCheckedChange={onWysiwygChange}
          disabled={disabled}
          aria-label={t('markdownEditor.wysiwygMode')}
        />
        <span className="markdown-editor-mode-label">
          {isWysiwyg ? t('markdownEditor.wysiwygMode') : t('markdownEditor.sourceMode')}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              disabled={disabled}
              aria-label={t('markdownEditor.menu')}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onNew}>
              <FilePlus />
              {t('markdownEditor.new')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpen}>
              <FolderOpen />
              {t('markdownEditor.open')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSave} disabled={!dirty}>
              <Save />
              {t('markdownEditor.save')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSaveAs}>
              <SaveAll />
              {t('markdownEditor.saveAs')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={exportHtml}>
              <FileCode2 />
              {t('markdownEditor.exportHtml')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyMarkdown()}>
              <Copy />
              {t('markdownEditor.copyMarkdown')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
