type SshDynamicPasswordPromptRequest = {
  connectionName: string
  resolve: (value: string | null) => void
}

let pending: SshDynamicPasswordPromptRequest | null = null
const listeners = new Set<() => void>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeSshDynamicPasswordPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSshDynamicPasswordPromptRequest(): SshDynamicPasswordPromptRequest | null {
  return pending
}

function finish(value: string | null): void {
  const current = pending
  pending = null
  notifyListeners()
  current?.resolve(value)
}

export function promptSshDynamicPassword(connectionName: string): Promise<string | null> {
  return new Promise((resolve) => {
    pending = { connectionName, resolve }
    notifyListeners()
  })
}

export function submitSshDynamicPassword(value: string): void {
  finish(value)
}

export function cancelSshDynamicPassword(): void {
  finish(null)
}
