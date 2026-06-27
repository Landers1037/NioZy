import { useMemo, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TFunction } from 'i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import type { CustomConnection } from '@/stores/app-store'
import { randomUUID } from '@/lib/id'
import { parseEnvLines, formatEnvLines } from '@/lib/connection-env'
import {
  collectSshGroups,
  connectionToDraft,
  draftToConnection,
  EMPTY_CONNECTION_DRAFT,
  getConnectionDraftPortError,
  hasDuplicateShellContextMenuName,
  type ConnectionDraft,
} from '@/lib/connection-draft'
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
  Copy,
  FileCode,
  Key,
  List,
  Lock,
  Network,
  Pencil,
  Plug,
  Server,
  ChevronDown,
  FolderTree,
  Star,
  Tag,
  Terminal,
  User,
} from 'lucide-react'
import {
  createConnection,
  isExternalConnectionType,
  launchExternalConnection,
} from '@/lib/terminal-actions'
import { defaultPuttyPort } from '@/lib/connection-draft'
import {
  ConnectionProtocolTag,
  connectionSavedSummary,
} from '@/lib/connection-protocol-tag'

function builtinConfigSummary(
  t: TFunction,
  args: string[],
  env: Record<string, string>,
): string {
  const parts: string[] = []
  if (args.length > 0) parts.push(t('settings.connections.argsCount', { count: args.length }))
  const envCount = Object.keys(env).length
  if (envCount > 0) parts.push(t('settings.connections.envCount', { count: envCount }))
  return parts.join(t('common.listSeparator'))
}

type ConnectionDraftFieldsProps = {
  draft: ConnectionDraft
  setDraft: (draft: ConnectionDraft) => void
  typeDisabled?: boolean
  fieldIdPrefix?: string
  existingSshGroups: string[]
  isWindows: boolean
  vncEnabled: boolean
  onBrowsePrivateKey: () => void
  t: TFunction
}

function ConnectionDraftFields({
  draft,
  setDraft,
  typeDisabled = false,
  fieldIdPrefix = '',
  existingSshGroups,
  isWindows,
  vncEnabled,
  onBrowsePrivateKey,
  t,
}: ConnectionDraftFieldsProps) {
  const shellContextMenuId = `${fieldIdPrefix}connection-shell-context-menu`
  const sshGroupsListId = `${fieldIdPrefix}ssh-connection-groups`
  return (
    <>
      <SettingField icon={Cable} label={t('settings.connections.type')}>
        <Select
          value={draft.type}
          disabled={typeDisabled}
          onValueChange={(v) => setDraft({ ...draft, type: v as ConnectionDraft['type'] })}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="command">{t('settings.connections.typeCommandCustom')}</SelectItem>
            <SelectItem value="ssh">{t('settings.connections.typeSsh')}</SelectItem>
            <SelectItem value="sftp">{t('settings.connections.typeSftp')}</SelectItem>
            {isWindows && (
              <>
                <SelectItem value="rdp">{t('settings.connections.typeRdp')}</SelectItem>
                <SelectItem value="wsl">{t('settings.connections.typeWsl')}</SelectItem>
                <SelectItem value="telnet">{t('settings.connections.typeTelnet')}</SelectItem>
                <SelectItem value="putty">{t('settings.connections.typePutty')}</SelectItem>
              </>
            )}
            {vncEnabled && <SelectItem value="vnc">{t('settings.connections.typeVnc')}</SelectItem>}
          </SelectContent>
        </Select>
      </SettingField>

      {draft.type === 'ssh' || draft.type === 'sftp' ? (
        <div className="grid grid-cols-2 gap-4">
          <SettingField icon={Tag} label={t('settings.connections.name')}>
            <Input
              value={draft.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: e.currentTarget.value })}
            />
          </SettingField>
          <SettingField icon={FolderTree} label={t('settings.connections.group')}>
            <div className="flex gap-1">
              <Input
                className="min-w-0 flex-1"
                value={draft.sshGroup}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, sshGroup: e.currentTarget.value })}
                placeholder={t('settings.connections.groupPlaceholder')}
                list={existingSshGroups.length > 0 ? sshGroupsListId : undefined}
              />
              {existingSshGroups.length > 0 && (
                <>
                  <datalist id={sshGroupsListId}>
                    {existingSshGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={t('settings.connections.pickGroup')}
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {existingSshGroups.map((g) => (
                        <DropdownMenuItem key={g} onClick={() => setDraft({ ...draft, sshGroup: g })}>
                          {g}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </SettingField>
        </div>
      ) : draft.type === 'command' ? (
        <div className="flex flex-col gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Label className="text-sm leading-none">{t('settings.connections.name')}</Label>
          </div>
          <div className="flex items-center gap-3">
            <Input
              className="min-w-0 flex-1"
              value={draft.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: e.currentTarget.value })}
            />
            {isWindows && (
              <div className="flex shrink-0 items-center gap-2">
                <Label
                  htmlFor={shellContextMenuId}
                  className="whitespace-nowrap text-sm font-normal text-muted-foreground"
                >
                  {t('settings.connections.shellContextMenu')}
                </Label>
                <Switch
                  id={shellContextMenuId}
                  checked={draft.shellContextMenu}
                  onCheckedChange={(shellContextMenu) => setDraft({ ...draft, shellContextMenu })}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <SettingField icon={Tag} label={t('settings.connections.name')}>
          <Input
            value={draft.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: e.currentTarget.value })}
          />
        </SettingField>
      )}

      {draft.type === 'rdp' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={Server} label={t('settings.connections.host')}>
              <Input
                value={draft.rdpHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, rdpHost: e.currentTarget.value })}
                placeholder="192.168.1.1"
              />
            </SettingField>
            <SettingField icon={Network} label={t('settings.connections.port')}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={draft.rdpPort}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, rdpPort: Number(e.currentTarget.value) || 3389 })}
              />
            </SettingField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={User} label={t('settings.connections.username')}>
              <Input
                value={draft.rdpUser}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, rdpUser: e.currentTarget.value })}
              />
            </SettingField>
            <SettingField icon={Lock} label={t('settings.connections.password')}>
              <InputWithVaultPicker
                type="password"
                wrapperClassName="w-full max-w-none"
                className="min-w-0 flex-1"
                value={draft.rdpPassword}
                onChange={(rdpPassword) => setDraft({ ...draft, rdpPassword })}
                placeholder={t('settings.connections.passwordPlaceholder')}
              />
            </SettingField>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.connections.rdpLaunchHint')}</p>
        </>
      ) : draft.type === 'vnc' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={Server} label={t('settings.connections.host')}>
              <Input
                value={draft.vncHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, vncHost: e.currentTarget.value })}
                placeholder="192.168.1.1"
              />
            </SettingField>
            <SettingField icon={Network} label={t('settings.connections.port')}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={draft.vncPort}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, vncPort: Number(e.currentTarget.value) || 5900 })}
              />
            </SettingField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={User} label={t('settings.connections.username')}>
              <Input
                value={draft.vncUsername}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, vncUsername: e.currentTarget.value })}
              />
            </SettingField>
            <SettingField icon={Lock} label={t('settings.connections.password')}>
              <InputWithVaultPicker
                type="password"
                wrapperClassName="w-full max-w-none"
                className="min-w-0 flex-1"
                value={draft.vncPassword}
                onChange={(vncPassword) => setDraft({ ...draft, vncPassword })}
                placeholder={t('settings.connections.passwordPlaceholder')}
              />
            </SettingField>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.connections.vncLaunchHint')}</p>
        </>
      ) : draft.type === 'wsl' ? (
        <>
          <SettingField icon={Terminal} label={t('settings.connections.wslDistro')}>
            <Input
              value={draft.wslDistro}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, wslDistro: e.currentTarget.value })}
              placeholder={t('settings.connections.wslDistroPlaceholder')}
            />
          </SettingField>
          <p className="text-xs text-muted-foreground">{t('settings.connections.wslLaunchHint')}</p>
        </>
      ) : draft.type === 'telnet' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={Server} label={t('settings.connections.host')}>
              <Input
                value={draft.telnetHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, telnetHost: e.currentTarget.value })}
                placeholder="192.168.1.1"
              />
            </SettingField>
            <SettingField icon={Network} label={t('settings.connections.port')}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={draft.telnetPort}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, telnetPort: Number(e.currentTarget.value) || 23 })}
              />
            </SettingField>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.connections.telnetLaunchHint')}</p>
        </>
      ) : draft.type === 'putty' ? (
        <>
          <SettingField icon={Cable} label={t('settings.connections.puttyProtocol')}>
            <Select
              value={draft.puttyProtocol}
              onValueChange={(v) => {
                const protocol = v as 'ssh' | 'telnet'
                setDraft({
                  ...draft,
                  puttyProtocol: protocol,
                  puttyPort: defaultPuttyPort(protocol),
                })
              }}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ssh">{t('settings.connections.puttyProtocolSsh')}</SelectItem>
                <SelectItem value="telnet">{t('settings.connections.puttyProtocolTelnet')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={Server} label={t('settings.connections.host')}>
              <Input
                value={draft.puttyHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, puttyHost: e.currentTarget.value })}
                placeholder="192.168.1.1"
              />
            </SettingField>
            <SettingField icon={Network} label={t('settings.connections.port')}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={draft.puttyPort}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setDraft({
                    ...draft,
                    puttyPort: Number(e.currentTarget.value) || defaultPuttyPort(draft.puttyProtocol),
                  })
                }
              />
            </SettingField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={User} label={t('settings.connections.username')}>
              <Input
                value={draft.puttyUser}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, puttyUser: e.currentTarget.value })}
                placeholder={t('settings.connections.puttyUserOptional')}
              />
            </SettingField>
            <SettingField icon={Lock} label={t('settings.connections.password')}>
              <InputWithVaultPicker
                type="password"
                wrapperClassName="w-full max-w-none"
                className="min-w-0 flex-1"
                value={draft.puttyPassword}
                onChange={(puttyPassword) => setDraft({ ...draft, puttyPassword })}
                placeholder={t('settings.connections.passwordPlaceholder')}
              />
            </SettingField>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.connections.puttyLaunchHint')}</p>
        </>
      ) : draft.type === 'ssh' || draft.type === 'sftp' ? (
        <>
          <SettingField icon={Key} label={t('settings.connections.authMethod')}>
            <div className="flex flex-wrap items-center gap-4">
              <Select
                value={draft.sshAuth}
                onValueChange={(v) => {
                  const sshAuth = v as 'password' | 'publickey'
                  setDraft({
                    ...draft,
                    sshAuth,
                    ...(sshAuth === 'publickey' ? { sshDynamicPassword: false } : {}),
                  })
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">{t('settings.connections.sshPasswordLogin')}</SelectItem>
                  <SelectItem value="publickey">{t('settings.connections.sshPublicKeyLogin')}</SelectItem>
                </SelectContent>
              </Select>
              {draft.type === 'ssh' && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${fieldIdPrefix}ssh-dynamic-password`}
                    className="whitespace-nowrap text-sm font-normal text-muted-foreground"
                  >
                    {t('settings.connections.sshDynamicPassword')}
                  </Label>
                  <Switch
                    id={`${fieldIdPrefix}ssh-dynamic-password`}
                    checked={draft.sshDynamicPassword}
                    disabled={draft.sshAuth !== 'password'}
                    onCheckedChange={(sshDynamicPassword) => setDraft({ ...draft, sshDynamicPassword })}
                  />
                </div>
              )}
            </div>
          </SettingField>
          {draft.type === 'ssh' && draft.sshDynamicPassword && draft.sshAuth === 'password' ? (
            <p className="text-xs text-muted-foreground">{t('settings.connections.sshDynamicPasswordHint')}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={Server} label={t('settings.connections.host')}>
              <Input
                value={draft.sshHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, sshHost: e.currentTarget.value })}
                placeholder="192.168.1.1"
              />
            </SettingField>
            <SettingField icon={Network} label={t('settings.connections.port')}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={draft.sshPort}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, sshPort: Number(e.currentTarget.value) })}
              />
            </SettingField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SettingField icon={User} label={t('settings.connections.username')}>
              <Input
                value={draft.sshUser}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, sshUser: e.currentTarget.value })}
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
                  showFileBrowse
                  onFileBrowse={() => void onBrowsePrivateKey()}
                  fileBrowseAriaLabel={t('settings.connections.browsePrivateKey')}
                />
              </SettingField>
            )}
          </div>

          {draft.type === 'ssh' && (
            <>
              <SettingField icon={FileCode} label={t('settings.connections.sshStartupScript')}>
                <TextareaWithVaultPicker
                  value={draft.sshStartupScript}
                  onChange={(sshStartupScript) => setDraft({ ...draft, sshStartupScript })}
                  placeholder={t('settings.connections.sshStartupScriptPlaceholder')}
                />
              </SettingField>
              <p className="text-xs text-muted-foreground">{t('settings.connections.sshStartupScriptHint')}</p>
            </>
          )}
        </>
      ) : (
        <>
          <SettingField icon={Terminal} label={t('settings.connections.command')}>
            <Input
              value={draft.command}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, command: e.currentTarget.value })}
              placeholder={t('settings.connections.commandPlaceholder')}
            />
          </SettingField>
          <SettingField icon={List} label={t('settings.connections.args')}>
            <Input
              value={draft.argsStr}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, argsStr: e.currentTarget.value })}
            />
          </SettingField>
          <SettingField icon={FileCode} label={t('settings.connections.envVars')}>
            <TextareaWithVaultPicker
              value={draft.envStr}
              onChange={(envStr) => setDraft({ ...draft, envStr })}
              placeholder="NODE_ENV=development"
            />
          </SettingField>
        </>
      )}
    </>
  )
}

export function ConnectionSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [editingBuiltin, setEditingBuiltin] = useState<BuiltinShellType | null>(null)
  const [builtinDraft, setBuiltinDraft] = useState({
    argsStr: '',
    envStr: '',
    setAsDefault: false,
  })
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [newDraft, setNewDraft] = useState<ConnectionDraft>(EMPTY_CONNECTION_DRAFT)
  const [editDraft, setEditDraft] = useState<ConnectionDraft>(EMPTY_CONNECTION_DRAFT)
  const existingSshGroups = useMemo(
    () => collectSshGroups(settings?.connections ?? []),
    [settings?.connections],
  )
  const isWindows = getElectronAPI().system.platform === 'win32'
  const vncEnabled = settings?.experimental.vncWebEnabled === true

  if (!settings) return null

  const startEditBuiltin = (shell: BuiltinShellType) => {
    const config = settings.builtinConnections[shell]
    setEditingBuiltin(shell)
    setBuiltinDraft({
      argsStr: config.args.join(' '),
      envStr: formatEnvLines(config.env),
      setAsDefault: settings.defaultTerminal === shell,
    })
  }

  const saveBuiltin = () => {
    if (!editingBuiltin) return
    const wasDefault = settings.defaultTerminal === editingBuiltin
    patchSettings({
      builtinConnections: {
        ...settings.builtinConnections,
        [editingBuiltin]: {
          args: builtinDraft.argsStr.split(' ').filter(Boolean),
          env: parseEnvLines(builtinDraft.envStr),
        },
      },
      defaultTerminal: builtinDraft.setAsDefault
        ? editingBuiltin
        : wasDefault
          ? 'powershell'
          : settings.defaultTerminal,
    })
    setEditingBuiltin(null)
  }

  const cancelEditConnection = () => {
    setEditingConnectionId(null)
    setEditDraft(EMPTY_CONNECTION_DRAFT)
  }

  const startEditConnection = (c: CustomConnection) => {
    setEditingConnectionId(c.id)
    setEditDraft(connectionToDraft(c))
  }

  const saveConnectionDraft = async (
    draft: ConnectionDraft,
    editingId: string | null,
    onSuccess: () => void,
  ) => {
    const id = editingId ?? randomUUID()
    if (
      draft.type === 'command' &&
      draft.shellContextMenu &&
      hasDuplicateShellContextMenuName(settings.connections, draft.name, editingId)
    ) {
      toast.error(t('toast.shellContextMenuDuplicateName'))
      return
    }

    const portError = getConnectionDraftPortError(draft)
    if (portError) {
      toast.error(t('connection.invalidPort', { port: portError.received }))
      return
    }

    const conn = draftToConnection(draft, id)
    if (!conn) return

    const connections = editingId
      ? settings.connections.map((c) => (c.id === editingId ? conn : c))
      : [...settings.connections, conn]

    try {
      await patchSettings({ connections })
      onSuccess()
    } catch {
      toast.error(t('toast.connectionContextMenuFailed'))
    }
  }

  const saveNewConnection = () =>
    void saveConnectionDraft(newDraft, null, () => setNewDraft(EMPTY_CONNECTION_DRAFT))

  const saveEditConnection = () =>
    void saveConnectionDraft(editDraft, editingConnectionId, cancelEditConnection)

  const removeConnection = (id: string) => {
    if (editingConnectionId === id) cancelEditConnection()
    patchSettings({
      connections: settings.connections.filter((c) => c.id !== id),
    })
  }

  const duplicateConnection = (c: CustomConnection) => {
    const existingNames = new Set(settings.connections.map((conn) => conn.name))
    let index = 1
    let name = `${c.name}-Copy${index}`
    while (existingNames.has(name)) {
      index += 1
      name = `${c.name}-Copy${index}`
    }
    const copy: CustomConnection = { ...c, id: randomUUID(), name }
    patchSettings({
      connections: [...settings.connections, copy],
    })
  }

  const browseNewPrivateKey = async () => {
    const path = await getElectronAPI().files.pickPrivateKey()
    if (path) setNewDraft((d) => ({ ...d, sshKeyPath: path }))
  }

  const browseEditPrivateKey = async () => {
    const path = await getElectronAPI().files.pickPrivateKey()
    if (path) setEditDraft((d) => ({ ...d, sshKeyPath: path }))
  }

  const draftFieldsProps = {
    existingSshGroups,
    isWindows,
    vncEnabled,
    t,
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
            const isDefault = settings.defaultTerminal === shell
            return (
              <div
                key={shell}
                className="rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t(`settings.connections.shell.${shell}`)}</p>
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-normal text-secondary-foreground">
                          <Star className="size-3 fill-current" />
                          {t('settings.connections.defaultTerminalBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[BUILTIN_SHELL_EXECUTABLE[shell], builtinConfigSummary(t, config.args, config.env)]
                        .filter(Boolean)
                        .join(' ')}
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
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setBuiltinDraft({ ...builtinDraft, argsStr: e.currentTarget.value })
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
                    <SettingField
                      icon={Star}
                      label={t('settings.connections.setDefaultTerminal')}
                      description={t('settings.connections.setDefaultTerminalDesc')}
                      row
                    >
                      <Switch
                        checked={builtinDraft.setAsDefault}
                        onCheckedChange={(setAsDefault) =>
                          setBuiltinDraft({ ...builtinDraft, setAsDefault })
                        }
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
          <ConnectionDraftFields
            draft={newDraft}
            setDraft={setNewDraft}
            fieldIdPrefix="new-"
            onBrowsePrivateKey={browseNewPrivateKey}
            {...draftFieldsProps}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveNewConnection}>{t('settings.connections.saveConnection')}</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editingConnectionId !== null}
        onOpenChange={(open) => {
          if (!open) cancelEditConnection()
        }}
      >
        <DialogContent
          className="flex max-h-[min(90vh,calc(100%-2rem))] max-w-2xl flex-col overflow-hidden p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t('settings.connections.editCustomTitle')}</DialogTitle>
            <DialogDescription>{t('settings.connections.editCustomDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <ConnectionDraftFields
              draft={editDraft}
              setDraft={setEditDraft}
              typeDisabled
              fieldIdPrefix="edit-"
              onBrowsePrivateKey={browseEditPrivateKey}
              {...draftFieldsProps}
            />
          </div>
          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button variant="ghost" onClick={cancelEditConnection}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveEditConnection}>{t('settings.connections.updateConnection')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div key={c.id} className="rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <ConnectionProtocolTag type={c.type} />
                    <p className="truncate font-semibold">{c.name}</p>
                  </div>
                  <p className="mt-1 truncate pl-0 text-xs text-muted-foreground">
                    {connectionSavedSummary(c, t)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {isWindows &&
                    (isExternalConnectionType(c.type) ||
                      c.type === 'wsl' ||
                      c.type === 'telnet') && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          void (isExternalConnectionType(c.type)
                            ? launchExternalConnection(c)
                            : createConnection('custom', c))
                        }
                      >
                        {t('settings.connections.connect')}
                      </Button>
                    )}
                  <Button variant="outline" size="sm" onClick={() => startEditConnection(c)}>
                    <Pencil className="size-3.5" />
                    {t('settings.connections.editSaved')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicateConnection(c)}>
                    <Copy className="size-3.5" />
                    {t('settings.connections.duplicate')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeConnection(c.id)}>
                    {t('settings.connections.delete')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
