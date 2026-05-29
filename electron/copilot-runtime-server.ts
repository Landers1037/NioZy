import './copilot-telemetry-env'
import { createServer, type Server } from 'node:http'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { CopilotRuntime, BuiltInAgent } from '@copilotkit/runtime/v2'
import { createCopilotNodeListener } from '@copilotkit/runtime/v2/node'
import {
  aiProviderUsesOpenAiApi,
  type AiRuntimeConfig,
} from './shared/ai-provider-settings'

const BASE_PATH = '/api/copilotkit'
const HOST = '127.0.0.1'

function clearProviderEnvKeys(): void {
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
}

function createBuiltInAgent(config: AiRuntimeConfig): BuiltInAgent {
  const { provider, model, baseUrl, apiKey } = config

  if (!aiProviderUsesOpenAiApi(provider)) {
    const anthropic = createAnthropic({
      apiKey: apiKey || 'missing-api-key',
      baseURL: baseUrl,
    })
    return new BuiltInAgent({ model: anthropic(model) })
  }

  const openai = createOpenAI({
    apiKey: apiKey || (provider === 'ollama' ? 'ollama' : 'missing-api-key'),
    baseURL: baseUrl,
  })
  return new BuiltInAgent({ model: openai(model) })
}

export class CopilotRuntimeServer {
  private server: Server | null = null
  private port = 0

  async sync(config: AiRuntimeConfig): Promise<string | null> {
    await this.stop()
    if (!config.enabled) {
      this.port = 0
      return null
    }

    clearProviderEnvKeys()

    const runtime = new CopilotRuntime({
      agents: {
        default: createBuiltInAgent(config),
      },
    })
    const listener = createCopilotNodeListener({
      runtime,
      basePath: BASE_PATH,
      cors: true,
      // Match CopilotKit client with useSingleEndpoint={false} (multi-route REST).
    })

    return new Promise((resolve, reject) => {
      const server = createServer(listener)
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Copilot Runtime port ${config.port} is already in use`))
          return
        }
        reject(err)
      })
      server.listen(config.port, HOST, () => {
        this.server = server
        this.port = config.port
        resolve(this.getRuntimeUrl())
      })
    })
  }

  async stop(resetPort = false): Promise<void> {
    const server = this.server
    this.server = null
    if (!server) {
      if (resetPort) this.port = 0
      return
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    if (resetPort) this.port = 0
  }

  getRuntimeUrl(): string | null {
    if (!this.server || !this.port) return null
    return `http://${HOST}:${this.port}${BASE_PATH}`
  }
}
