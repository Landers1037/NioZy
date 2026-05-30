import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListOrdered, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingField } from '@/components/settings/SettingField'
import { CommandReplayList } from '@/components/command-replay/CommandReplayList'
import {
  CommandReplayEditDialog,
  type CommandReplayEditValues,
} from '@/components/command-replay/CommandReplayEditDialog'
import { useCommandReplayCrud } from '@/components/command-replay/useCommandReplayCrud'
import type { CommandReplayItem } from '../../../electron/shared/command-replay'

export function CommandReplaySettingsSection() {
  const { t } = useTranslation()
  const { items, upsert, remove, createFromValues } = useCommandReplayCrud()
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [editInitial, setEditInitial] = useState<CommandReplayEditValues>({ name: '', command: '' })
  const [editingId, setEditingId] = useState<string | undefined>()

  const openCreate = () => {
    setEditMode('create')
    setEditingId(undefined)
    setEditInitial({
      name: t('commandReplay.defaultName', { index: items.length + 1 }),
      command: '',
    })
    setEditOpen(true)
  }

  const openEdit = (item: CommandReplayItem) => {
    setEditMode('edit')
    setEditingId(item.id)
    setEditInitial({ name: item.name, command: item.command })
    setEditOpen(true)
  }

  const handleSave = (values: CommandReplayEditValues) => {
    upsert(createFromValues(values, editingId))
  }

  return (
    <>
      <SettingField
        icon={ListOrdered}
        label={t('settings.shell.commandReplayList')}
        description={t('settings.shell.commandReplayListDesc')}
      >
        <div className="flex w-full max-w-xl flex-col gap-2">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={openCreate}>
              <Plus className="size-3.5" />
              {t('commandReplay.add')}
            </Button>
          </div>
          <CommandReplayList
            items={items}
            variant="settings"
            onEdit={openEdit}
            onDelete={(item) => remove(item.id)}
          />
        </div>
      </SettingField>

      <CommandReplayEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode={editMode}
        initial={editInitial}
        onSave={handleSave}
      />
    </>
  )
}
