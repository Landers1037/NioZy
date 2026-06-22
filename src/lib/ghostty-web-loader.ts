import ghosttyWasmUrl from 'ghostty-web/ghostty-vt.wasm?url'
import type { ITerminalOptions } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { SerializeAddon } from '@xterm/addon-serialize'
import type { TerminalEmulator } from '../../electron/shared/experimental-settings'

type GhosttyModule = typeof import('ghostty-web')
type GhosttyInstance = Awaited<ReturnType<GhosttyModule['Ghostty']['load']>>

let sharedGhostty: GhosttyInstance | null = null
let sharedGhosttyPromise: Promise<GhosttyInstance> | null = null

export async function getSharedGhosttyInstance(): Promise<GhosttyInstance> {
  if (sharedGhostty) return sharedGhostty
  if (!sharedGhosttyPromise) {
    sharedGhosttyPromise = (async () => {
      const { Ghostty } = await import('ghostty-web')
      sharedGhostty = await Ghostty.load(ghosttyWasmUrl)
      return sharedGhostty
    })()
  }
  return sharedGhosttyPromise
}

export interface LoadedTerminalModules {
  Terminal: new (options?: ITerminalOptions) => import('@xterm/xterm').Terminal
  FitAddon: new () => FitAddon
  ghostty: GhosttyInstance | null
  SerializeAddon: typeof SerializeAddon | null
}

export async function loadTerminalModules(
  emulator: TerminalEmulator,
  options: { includeSerialize?: boolean } = {},
): Promise<LoadedTerminalModules> {
  if (emulator === 'ghostty') {
    const [{ Terminal, FitAddon }, ghostty] = await Promise.all([
      import('ghostty-web'),
      getSharedGhosttyInstance(),
    ])
    return {
      Terminal: Terminal as unknown as LoadedTerminalModules['Terminal'],
      FitAddon: FitAddon as unknown as LoadedTerminalModules['FitAddon'],
      ghostty,
      SerializeAddon: null,
    }
  }

  await import('@xterm/xterm/css/xterm.css')
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
  ])
  let SerializeAddonCtor: typeof SerializeAddon | null = null
  if (options.includeSerialize) {
    SerializeAddonCtor = (await import('@xterm/addon-serialize')).SerializeAddon
  }
  return { Terminal, FitAddon, ghostty: null, SerializeAddon: SerializeAddonCtor }
}
