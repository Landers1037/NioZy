import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import type { CustomConnection } from '@/stores/app-store'
import { randomUUID } from '@/lib/id'
import { parseEnvLines, formatEnvLines } from '@/lib/connection-env'
import {
  BUILTIN_SHELL_TYPES,
  BUILTIN_SHELL_EXECUTABLE,
  type BuiltinShellType,
} from '../../../electron/shared/builtin-shells'
import { SettingField } from './SettingField'
import { TextareaWithVaultPicker } from './TextareaWithVaultPicker'
import { InputWithVaultPicker } from './InputWithVaultPicker'
import {
  Cable,
  FileCode,
  Key,
  List,
  Lock,
  Network,
  Pencil,
  Plug,
  Server,
  Tag,
  Terminal,
  User,
} from 'lucide-react'

function builtinConfigSummary(
  t: TFunction,
  args: string[],
  env: Record<string, string>,
): string {
  const parts: string[] = []
  if (args.length > 0) parts.push(t('settings.connections.argsCount', { count: args.length }))
  const envCount = Object.keys(env).length
  if (envCount > 0) parts.push(t('settings.connections.envCount', { count: envCount }))
  return parts.length > 0
    ? parts.join(t('common.listSeparator'))
    : t('settings.connections.defaultLaunch')
}

export function ConnectionSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [editingBuiltin, setEditingBuiltin] = useState<BuiltinShellType | null>(null)
  const [builtinDraft, setBuiltinDraft] = useState({ argsStr: '', envStr: '' })
  const [draft, setDraft] = useState({
    type: 'command' as 'command' | 'ssh',
    name: '',
    command: '',
    argsStr: '',
    envStr: '',
    sshUser: '',
    sshHost: '',
    sshPort: 22,
    sshAuth: 'password' as 'password' | 'publickey',
    sshPassword: '',
    sshKeyPath: '',
  })

  if (!settings) return null

  const startEditBuiltin = (shell: BuiltinShellType) => {
    const config = settings.builtinConnections[shell]
    setEditingBuiltin(shell)
    setBuiltinDraft({
      argsStr: config.args.join(' '),
      envStr: formatEnvLines(config.env),
    })
  }

  const saveBuiltin = () => {
    if (!editingBuiltin) return
    patchSettings({
      builtinConnections: {
        ...settings.builtinConnections,
        [editingBuiltin]: {
          args: builtinDraft.argsStr.split(' ').filter(Boolean),
          env: parseEnvLines(builtinDraft.envStr),
        },
      },
    })
    setEditingBuiltin(null)
  }

  const saveConnection = () => {
    if (!draft.name.trim()) return

    let conn: CustomConnection

    if (draft.type === 'ssh') {
      if (!draft.sshHost.trim() || !draft.sshUser.trim()) return
      conn = {
        id: randomUUID(),
        name: draft.name.trim(),
        type: 'ssh',
        command: draft.sshHost.trim(),
        args: [],
        env: {},
        sshAuth: draft.sshAuth,
        sshUser: draft.sshUser.trim(),
        sshHost: draft.sshHost.trim(),
        sshPort: draft.sshPort,
        sshPassword:
          draft.sshAuth === 'password' && draft.sshPassword.trim()
            ? draft.sshPassword.trim()
            : undefined,
        sshKeyPath:
          draft.sshAuth === 'publickey' && draft.sshKeyPath.trim()
            ? draft.sshKeyPath.trim()
            : undefined,
      }
    } else {
      if (!draft.command.trim()) return
      conn = {
        id: randomUUID(),
        name: draft.name.trim(),
        type: 'command',
        command: draft.command.trim(),
        args: draft.argsStr.split(' ').filter(Boolean),
        env: parseEnvLines(draft.envStr),
      }
    }

    patchSettings({ connections: [...settings.connections, conn] })
    setDraft({
      type: 'command',
      name: '',
      command: '',
      argsStr: '',
      envStr: '',
      sshUser: '',
      sshHost: '',
      sshPort: 22,
      sshAuth: 'password',
      sshPassword: '',
      sshKeyPath: '',
    })
  }

  const removeConnection = (id: string) => {
    patchSettings({
      connections: settings.connections.filter((c) => c.id !== id),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-5" />
            {t('settings.connections.builtinTitle')}
          </CardTitle>
          <CardDescription>{t('settings.connections.builtinDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {BUILTIN_SHELL_TYPES.map((shell) => {
            const config = settings.builtinConnections[shell]
            const isEditing = editingBuiltin === shell
            return (
              <div
                key={shell}
                className="rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{t(`settings.connections.shell.${shell}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {BUILTIN_SHELL_EXECUTABLE[shell]} ·{' '}
                      {builtinConfigSummary(t, config.args, config.env)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      isEditing ? setEditingBuiltin(null) : startEditBuiltin(shell)
                    }
                  >
                    <Pencil className="size-3.5" />
                    {isEditing ? t('settings.connections.collapse') : t('settings.connections.editBuiltin')}
                  </Button>
                </div>
                {isEditing && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
                    <SettingField icon={List} label={t('settings.connections.launchArgs')}>
                      <Input
                        value={builtinDraft.argsStr}
                        onChange={(e) =>
                          setBuiltinDraft({ ...builtinDraft, argsStr: e.target.value })
                        }
                        placeholder="-NoLogo -ExecutionPolicy Bypass"
                      />
                    </SettingField>
                    <SettingField
                      icon={FileCode}
                      label={t('settings.connections.envVars')}
                    >
                      <TextareaWithVaultPicker
                        value={builtinDraft.envStr}
                        onChange={(envStr) => setBuiltinDraft({ ...builtinDraft, envStr })}
                        placeholder="NODE_ENV=development"
                      />
                    </SettingField>
                    <div className="flex gap-2">
                      <Button onClick={saveBuiltin}>{t('common.save')}</Button>
                      <Button variant="ghost" onClick={() => setEditingBuiltin(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="size-5" />
            {t('settings.connections.addCustomTitle')}
          </CardTitle>
          <CardDescription>{t('settings.connections.addCustomDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SettingField icon={Cable} label={t('settings.connections.type')}>
            <Select
              value={draft.type}
              onValueChange={(v) => setDraft({ ...draft, type: v as 'command' | 'ssh' })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="command">{t('settings.connections.typeCommandCustom')}</SelectItem>
                <SelectItem value="ssh">{t('settings.connections.typeSsh')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField icon={Tag} label={t('settings.connections.name')}>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </SettingField>

          {draft.type === 'ssh' ? (
            <>
              <SettingField icon={Key} label={t('settings.connections.authMethod')}>
                <Select
                  value={draft.sshAuth}
                  onValueChange={(v) =>
                    setDraft({ ...draft, sshAuth: v as 'password' | 'publickey' })
                  }
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password">{t('settings.connections.sshPasswordLogin')}</SelectItem>
                    <SelectItem value="publickey">{t('settings.connections.sshPublicKeyLogin')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingField>

              <div className="grid grid-cols-2 gap-4">
                <SettingField icon={Server} label={t('settings.connections.host')}>
                  <Input
                    value={draft.sshHost}
                    onChange={(e) => setDraft({ ...draft, sshHost: e.target.value })}
                    placeholder="192.168.1.1"
                  />
                </SettingField>
                <SettingField icon={Network} label={t('settings.connections.port')}>
                  <Input
                    type="number"
                    value={draft.sshPort}
                    onChange={(e) => setDraft({ ...draft, sshPort: Number(e.target.value) })}
                  />
                </SettingField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SettingField icon={User} label={t('settings.connections.username')}>
                  <Input
                    value={draft.sshUser}
                    onChange={(e) => setDraft({ ...draft, sshUser: e.target.value })}
                  />
                </SettingField>
                {draft.sshAuth === 'password' ? (
                  <SettingField icon={Lock} label={t('settings.connections.password')}>
                    <InputWithVaultPicker
                      type="password"
                      wrapperClassName="w-full max-w-none"
                      className="min-w-0 flex-1"
                      value={draft.sshPassword}
                      onChange={(sshPassword) => setDraft({ ...draft, sshPassword })}
                      placeholder={t('settings.connections.passwordPlaceholder')}
                    />
                  </SettingField>
                ) : (
                  <SettingField icon={FileCode} label={t('settings.connections.privateKeyPath')}>
                    <InputWithVaultPicker
                      wrapperClassName="w-full max-w-none"
                      className="min-w-0 flex-1"
                      value={draft.sshKeyPath}
                      onChange={(sshKeyPath) => setDraft({ ...draft, sshKeyPath })}
                      placeholder={t('settings.connections.privateKeyPlaceholder')}
                    />
                  </SettingField>
                )}
              </div>
            </>
          ) : (
            <>
              <SettingField icon={Terminal} label={t('settings.connections.command')}>
                <Input
                  value={draft.command}
                  onChange={(e) => setDraft({ ...draft, command: e.target.value })}
                  placeholder={t('settings.connections.commandPlaceholder')}
                />
              </SettingField>
              <SettingField icon={List} label={t('settings.connections.args')}>
                <Input
                  value={draft.argsStr}
                  onChange={(e) => setDraft({ ...draft, argsStr: e.target.value })}
                />
              </SettingField>
              <SettingField
                icon={FileCode}
                label={t('settings.connections.envVars')}
              >
                <TextareaWithVaultPicker
                  value={draft.envStr}
                  onChange={(envStr) => setDraft({ ...draft, envStr })}
                  placeholder="NODE_ENV=development"
                />
              </SettingField>
            </>
          )}

          <Button onClick={saveConnection}>{t('settings.connections.saveConnection')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.connections.savedConnections')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {settings.connections.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('settings.connections.noCustomConnections')}
            </p>
          )}
          {settings.connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.type === 'ssh' ? `ssh ${c.sshUser}@${c.sshHost}` : c.command}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeConnection(c.id)}>
                {t('settings.connections.delete')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
