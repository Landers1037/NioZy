import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, Command } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CommandReplayList } from '@/components/command-replay/CommandReplayList'
import {
  CommandReplayEditDialog,
  type CommandReplayEditValues,
} from '@/components/command-replay/CommandReplayEditDialog'
import { useCommandReplayCrud } from '@/components/command-replay/useCommandReplayCrud'
import { useCommandReplayStore } from '@/stores/command-replay-store'
import {
  getActiveReplayTerminalId,
  replayCommandToTerminal,
} from '@/lib/command-replay'
import type { CommandReplayItem } from '../../../electron/shared/command-replay'

const titleBarMenuIconClass = 'size-3.5 shrink-0 text-muted-foreground'

const titleBarMenuBtnClass =
  'h-7 gap-1.5 rounded-full border-border/60 bg-muted/40 px-2.5 text-xs font-normal text-foreground shadow-none hover:bg-muted focus:bg-muted/40 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-muted/40 data-[state=open]:ring-0 active:bg-muted/40'

export function TitleBarCommandReplay() {
  const { t } = useTranslation()
  const { items, upsert, createFromValues } = useCommandReplayCrud()
  const isRecording = useCommandReplayStore((s) => s.isRecording)
  const startRecording = useCommandReplayStore((s) => s.start)
  const stopRecording = useCommandReplayStore((s) => s.stop)

  const [panelOpen, setPanelOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [editInitial, setEditInitial] = useState<CommandReplayEditValues>({ name: '', command: '' })
  const [pendingEditId, setPendingEditId] = useState<string | undefined>()

  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      setPanelOpen(false)
      closeTimerRef.current = null
    }, 200)
  }

  useEffect(() => {
    return () => cancelClose()
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [panelOpen])

  const openCreateDialog = (initial: CommandReplayEditValues, id?: string) => {
    setEditMode('create')
    setEditInitial(initial)
    setPendingEditId(id)
    setEditOpen(true)
  }

  const toggleRecord = () => {
    if (isRecording) {
      const buffer = stopRecording()
      if (!buffer) {
        toast.message(t('commandReplay.recordEmpty'))
        return
      }
      openCreateDialog({
        name: t('commandReplay.defaultName', { index: items.length + 1 }),
        command: buffer,
      })
      return
    }

    const terminalId = getActiveReplayTerminalId()
    if (!terminalId) {
      toast.error(t('commandReplay.noActiveTerminal'))
      return
    }
    startRecording(terminalId)
    toast.message(t('commandReplay.recordingStarted'))
  }

  const handleReplay = (item: CommandReplayItem) => {
    if (!replayCommandToTerminal(item.command)) {
      toast.error(t('commandReplay.noActiveTerminal'))
      return
    }
    setPanelOpen(false)
  }

  const handleSaveEdit = (values: CommandReplayEditValues) => {
    const item = createFromValues(values, pendingEditId)
    upsert(item)
    setPendingEditId(undefined)
    toast.success(t('commandReplay.saved'))
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => {
          cancelClose()
          setPanelOpen(true)
        }}
        onMouseLeave={() => {
          if (!panelOpen) return
          scheduleClose()
        }}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(titleBarMenuBtnClass, 'w-7 px-0', isRecording && 'border-destructive/60')}
          aria-label={t('titleBar.commands')}
          title={t('titleBar.commands')}
        >
          <Command className={titleBarMenuIconClass} aria-hidden />
        </Button>

        {panelOpen ? (
          <div
            className="absolute left-1/2 top-full z-50 w-[300px] -translate-x-1/2 translate-y-2 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur"
            onMouseEnter={() => cancelClose()}
            onMouseLeave={() => scheduleClose()}
          >
            <div className="flex items-center gap-2 px-1 pb-2">
              <Button
                type="button"
                size="sm"
                variant={isRecording ? 'destructive' : 'secondary'}
                className="h-7 flex-1 gap-1.5 text-xs"
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleRecord}
              >
                <Circle
                  className={cn('size-2.5 fill-current', isRecording && 'animate-pulse')}
                  aria-hidden
                />
                {isRecording ? t('commandReplay.stopRecord') : t('commandReplay.startRecord')}
              </Button>
            </div>
            <CommandReplayList
              items={items}
              variant="panel"
              onReplay={handleReplay}
            />
          </div>
        ) : null}
      </div>

      <CommandReplayEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode={editMode}
        initial={editInitial}
        onSave={handleSaveEdit}
      />
    </>
  )
}
