import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { findGroupForTab } from '@/lib/tab-groups'
import { useTabGroupStore } from '@/stores/tab-group-store'

const NEW_GROUP_VALUE = '__new__'

interface AddToGroupDialogProps {
  tabId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddToGroupDialog({ tabId, open, onOpenChange }: AddToGroupDialogProps) {
  const { t } = useTranslation()
  const groups = useTabGroupStore((s) => s.groups)
  const activeGroupId = useTabGroupStore((s) => s.activeGroupId)
  const addTabToGroup = useTabGroupStore((s) => s.addTabToGroup)
  const addTabToNewGroup = useTabGroupStore((s) => s.addTabToNewGroup)

  const hasGroups = groups.length > 0
  const existingGroup = findGroupForTab(groups, tabId)
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    hasGroups ? groups[0].id : NEW_GROUP_VALUE,
  )
  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    if (!open) return
    if (existingGroup) {
      setSelectedGroupId(existingGroup.id)
    } else if (activeGroupId && groups.some((g) => g.id === activeGroupId)) {
      setSelectedGroupId(activeGroupId)
    } else if (hasGroups) {
      setSelectedGroupId(groups[0].id)
    } else {
      setSelectedGroupId(NEW_GROUP_VALUE)
    }
    setNewGroupName('')
  }, [open, hasGroups, groups, existingGroup, activeGroupId, tabId])

  const isNewGroup = !hasGroups || selectedGroupId === NEW_GROUP_VALUE
  const canSubmit = isNewGroup ? newGroupName.trim().length > 0 : true

  const handleSubmit = () => {
    if (!canSubmit) return
    if (isNewGroup) {
      addTabToNewGroup(tabId, newGroupName)
    } else {
      addTabToGroup(tabId, selectedGroupId)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('tab.addToGroup')}</DialogTitle>
          <DialogDescription>{t('tab.addToGroupDesc')}</DialogDescription>
        </DialogHeader>

        {hasGroups ? (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t('tab.selectGroup')}</label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_GROUP_VALUE}>{t('tab.createNewGroup')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {isNewGroup ? (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t('tab.groupName')}</label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('tab.groupNamePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit()
              }}
              autoFocus
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {t('common.ok')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
