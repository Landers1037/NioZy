import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, Plus, Save, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getElectronAPI } from '@/lib/electron-client'
import { devError } from '../../../electron/shared/dev-log'
import type { NoteItem } from '../../../electron/shared/note-types'

type Mode = 'list' | 'edit'

function formatNoteForClipboard(note: NoteItem): string {
  return note.content?.trim() ?? ''
}

export function NotesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<NoteItem[]>([])
  const [mode, setMode] = useState<Mode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const editing = useMemo(
    () => (editingId ? items.find((n) => n.id === editingId) ?? null : null),
    [items, editingId],
  )

  const refresh = async () => {
    setLoading(true)
    try {
      const list = await getElectronAPI().notes.list()
      setItems(list)
    } catch (err) {
      toast.error(t('notes.loadFailed'))
      devError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void refresh()
    setMode('list')
    setEditingId(null)
    setTitle('')
    setContent('')
  }, [open])

  const beginCreate = () => {
    setMode('edit')
    setEditingId(null)
    setTitle('')
    setContent('')
  }

  const beginEdit = (note: NoteItem) => {
    setMode('edit')
    setEditingId(note.id)
    setTitle(note.title)
    setContent(note.content)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await getElectronAPI().notes.save({
        id: editingId ?? undefined,
        title,
        content,
      })
      setItems((prev) => {
        const idx = prev.findIndex((n) => n.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next.splice(idx, 1, saved)
          return next
        }
        return [saved, ...prev]
      })
      toast.success(t('notes.saved'))
      setMode('list')
      setEditingId(null)
    } catch (err) {
      toast.error(t('notes.saveFailed'))
      devError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async (note: NoteItem) => {
    const text = formatNoteForClipboard(note)
    if (!text) {
      toast.message(t('notes.copyEmpty'))
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('notes.copied'))
    } catch (err) {
      toast.error(t('notes.copyFailed'))
      devError(err)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await getElectronAPI().notes.delete(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
      if (editingId === id) {
        setMode('list')
        setEditingId(null)
      }
      toast.success(t('notes.deleted'))
    } catch (err) {
      toast.error(t('notes.deleteFailed'))
      devError(err)
    } finally {
      setDeletingId(null)
    }
  }

  const canSave = title.trim().length > 0 || content.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('notes.title')}</DialogTitle>
        </DialogHeader>

        {mode === 'list' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {loading ? t('common.loading') : t('notes.count', { count: items.length })}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={beginCreate}>
                  <Plus className="mr-1.5 size-4" aria-hidden />
                  {t('notes.new')}
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">{t('notes.empty')}</div>
              ) : (
                <div className="divide-y">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex w-full items-start gap-3 p-3 hover:bg-muted/40',
                        editingId === n.id && 'bg-muted/30',
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left hover:opacity-80"
                        onClick={() => beginEdit(n)}
                      >
                        <div className="truncate text-sm font-medium">
                          {n.title?.trim() ? n.title : t('notes.untitled')}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {n.content}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void handleCopy(n)
                          }}
                          aria-label={t('notes.copy')}
                          title={t('notes.copy')}
                        >
                          <Copy className="size-4 text-muted-foreground" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === n.id}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void handleDelete(n.id)
                          }}
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                        >
                          <Trash2 className="size-4 text-muted-foreground" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('notes.titlePlaceholder')}
                autoComplete="off"
              />
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('notes.contentPlaceholder')}
                className="min-h-[220px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMode('list')
                  setEditingId(null)
                }}
              >
                {t('common.cancel')}
              </Button>
              <div className="flex items-center gap-2">
                {editing ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingId === editing.id}
                    onClick={() => void handleDelete(editing.id)}
                  >
                    <Trash2 className="mr-1.5 size-4" aria-hidden />
                    {t('common.delete')}
                  </Button>
                ) : null}
                <Button type="button" disabled={!canSave || saving} onClick={() => void handleSave()}>
                  <Save className="mr-1.5 size-4" aria-hidden />
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

