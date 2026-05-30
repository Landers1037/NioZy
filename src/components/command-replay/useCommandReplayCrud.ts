import { useCallback } from 'react'
import type { CommandReplayItem } from '../../../electron/shared/command-replay'
import { useAppStore } from '@/stores/app-store'
import { getCommandReplays } from '@/lib/command-replay'
import { randomUUID } from '@/lib/id'

export function useCommandReplayCrud() {
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)

  const items = getCommandReplays(settings)

  const upsert = useCallback(
    (item: CommandReplayItem) => {
      if (!settings) return
      const shell = settings.shell
      const existing = shell.commandReplays ?? []
      const next = existing.some((c) => c.id === item.id)
        ? existing.map((c) => (c.id === item.id ? item : c))
        : [...existing, item]
      void patchSettings({ shell: { ...shell, commandReplays: next } })
    },
    [patchSettings, settings],
  )

  const remove = useCallback(
    (id: string) => {
      if (!settings) return
      const shell = settings.shell
      void patchSettings({
        shell: {
          ...shell,
          commandReplays: (shell.commandReplays ?? []).filter((c) => c.id !== id),
        },
      })
    },
    [patchSettings, settings],
  )

  const createFromValues = useCallback(
    (values: { name: string; command: string }, id?: string): CommandReplayItem => ({
      id: id ?? randomUUID(),
      name: values.name,
      command: values.command,
    }),
    [],
  )

  return { items, upsert, remove, createFromValues }
}
