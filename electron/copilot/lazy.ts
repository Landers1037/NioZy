import type { AiRuntimeConfig } from '../shared/ai-provider-settings'

type CopilotRuntimeServer = import('./runtime-server').CopilotRuntimeServer

let server: CopilotRuntimeServer | null = null
let loadPromise: Promise<CopilotRuntimeServer> | null = null

async function loadServer(): Promise<CopilotRuntimeServer> {
  if (server) return server
  if (!loadPromise) {
    loadPromise = import('./runtime-server').then((mod) => {
      server = new mod.CopilotRuntimeServer()
      return server
    })
  }
  return loadPromise
}

/** 关闭 HTTP 服务；unload 为 true 时卸载 Copilot 模块以便 GC */
export async function disposeCopilotRuntime(unload = false): Promise<void> {
  if (server) {
    await server.stop(unload)
  }
  if (unload) {
    server = null
    loadPromise = null
  }
}

export async function syncCopilotRuntime(config: AiRuntimeConfig): Promise<string | null> {
  if (!config.enabled) {
    await disposeCopilotRuntime(true)
    return null
  }
  const runtime = await loadServer()
  return runtime.sync(config)
}

export function getCopilotRuntimeUrl(): string | null {
  return server?.getRuntimeUrl() ?? null
}
