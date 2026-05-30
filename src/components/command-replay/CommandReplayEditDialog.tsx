import { useEffect, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface CommandReplayEditValues {
  name: string
  command: string
}

interface CommandReplayEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initial: CommandReplayEditValues
  onSave: (values: CommandReplayEditValues) => void
}

export function CommandReplayEditDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSave,
}: CommandReplayEditDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial.name)
  const [command, setCommand] = useState(initial.command)

  useEffect(() => {
    if (!open) return
    setName(initial.name)
    setCommand(initial.command)
  }, [open, initial.name, initial.command])

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName || !command) return
    onSave({ name: trimmedName, command })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('commandReplay.editDialog.createTitle')
              : t('commandReplay.editDialog.editTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="command-replay-name">{t('commandReplay.editDialog.name')}</Label>
            <Input
              id="command-replay-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('commandReplay.editDialog.namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="command-replay-command">{t('commandReplay.editDialog.command')}</Label>
            <textarea
              id="command-replay-command"
              value={command}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCommand(e.target.value)}
              className={cn(
                'min-h-[120px] w-full rounded-lg border border-border bg-muted p-2 font-mono text-xs',
              )}
              spellCheck={false}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !command}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
