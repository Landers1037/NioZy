import { createWriteStream, existsSync } from 'fs'
import { chmod, rename, rm } from 'fs/promises'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { ensureAgentBinaryDir, getAgentBinaryDir } from './config-paths'
import {
  getAgentBinaryCandidates,
  getAgentExecutableName,
  getDownloadedAgentBinaryPath,
  inspectAgentBinaryPath,
  type AgentBinarySource,
} from './agent-binary-path'

const AGENT_RELEASE_OWNER = 'Landers1037'
const AGENT_RELEASE_REPO = 'NioZy-Agent-Release'
const GITHUB_USER_AGENT = 'NioZy-Agent-Downloader'

interface GithubReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GithubRelease {
  tag_name?: string
  name?: string
  assets?: GithubReleaseAsset[]
}

export interface AgentBinaryStatusResult {
  activePath: string
  activeSource: AgentBinarySource
  downloadDir: string
  downloadPath: string
  downloadedBinaryExists: boolean
  candidatePaths: Array<{ path: string; source: AgentBinarySource }>
}

export type AgentBinaryDownloadResult =
  | {
      ok: true
      binaryPath: string
      releaseTag: string
      assetName: string
      overwritten: boolean
    }
  | {
      ok: false
      error: string
      code:
        | 'ALREADY_EXISTS'
        | 'NO_RELEASE_ASSET'
        | 'AMBIGUOUS_RELEASE_ASSET'
        | 'DOWNLOAD_FAILED'
        | 'HTTP_ERROR'
    }

function githubLatestReleaseApiUrl(): string {
  return `https://api.github.com/repos/${AGENT_RELEASE_OWNER}/${AGENT_RELEASE_REPO}/releases/latest`
}

async function githubFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
    },
    redirect: 'follow',
  })
}

function getPlatformTokens(): string[] {
  switch (process.platform) {
    case 'win32':
      return ['windows', 'win32', 'win']
    case 'darwin':
      return ['darwin', 'macos', 'mac', 'osx']
    default:
      return ['linux']
  }
}

function getArchTokens(): string[] {
  switch (process.arch) {
    case 'x64':
      return ['x64', 'amd64']
    case 'arm64':
      return ['arm64', 'aarch64']
    default:
      return [process.arch]
  }
}

function pickReleaseAsset(assets: GithubReleaseAsset[]): GithubReleaseAsset {
  const downloadables = assets.filter(
    (asset) => asset.name?.trim() && asset.browser_download_url?.trim(),
  )
  const exactName = getAgentExecutableName()
  const exact = downloadables.find(
    (asset) => asset.name?.toLowerCase() === exactName.toLowerCase(),
  )
  if (exact) return exact

  const extensionFiltered = downloadables.filter((asset) => {
    const name = asset.name!.toLowerCase()
    if (process.platform === 'win32') return name.endsWith('.exe')
    return !/\.(zip|tar|gz|tgz|bz2|xz|dmg|pkg|msi|exe)$/i.test(name)
  })

  const compatible = extensionFiltered.filter((asset) => {
    const lower = asset.name!.toLowerCase()
    const hasPlatform = getPlatformTokens().some((token) => lower.includes(token))
    const hasArch = getArchTokens().some((token) => lower.includes(token))
    return hasPlatform && hasArch
  })

  if (compatible.length === 1) return compatible[0]!
  if (extensionFiltered.length === 1) return extensionFiltered[0]!

  if (compatible.length === 0) {
    throw Object.assign(new Error('No compatible release asset found'), {
      code: 'NO_RELEASE_ASSET',
    })
  }

  throw Object.assign(
    new Error(
      `Multiple compatible release assets found: ${compatible
        .map((asset) => asset.name)
        .join(', ')}`,
    ),
    { code: 'AMBIGUOUS_RELEASE_ASSET' },
  )
}

export function getAgentBinaryStatus(): AgentBinaryStatusResult {
  const active = inspectAgentBinaryPath()
  const downloadPath = getDownloadedAgentBinaryPath()
  return {
    activePath: active.path,
    activeSource: active.source,
    downloadDir: getAgentBinaryDir(),
    downloadPath,
    downloadedBinaryExists: existsSync(downloadPath),
    candidatePaths: getAgentBinaryCandidates().map((candidate) => ({
      path: candidate.path,
      source: candidate.source,
    })),
  }
}

export async function downloadLatestAgentBinary(
  overwrite: boolean,
): Promise<AgentBinaryDownloadResult> {
  const targetPath = getDownloadedAgentBinaryPath()
  const alreadyExists = existsSync(targetPath)

  if (alreadyExists && !overwrite) {
    return {
      ok: false,
      code: 'ALREADY_EXISTS',
      error: `Agent binary already exists: ${targetPath}`,
    }
  }

  try {
    ensureAgentBinaryDir()
    const releaseRes = await githubFetch(githubLatestReleaseApiUrl())
    if (!releaseRes.ok) {
      return {
        ok: false,
        code: 'HTTP_ERROR',
        error: `GitHub API ${releaseRes.status}: ${releaseRes.statusText}`,
      }
    }

    const release = (await releaseRes.json()) as GithubRelease
    const asset = pickReleaseAsset(release.assets ?? [])
    const assetUrl = asset.browser_download_url
    const assetName = asset.name
    if (!assetUrl || !assetName) {
      return {
        ok: false,
        code: 'NO_RELEASE_ASSET',
        error: 'Latest release does not contain a downloadable asset',
      }
    }

    const downloadRes = await githubFetch(assetUrl)
    if (!downloadRes.ok || !downloadRes.body) {
      return {
        ok: false,
        code: 'DOWNLOAD_FAILED',
        error: `Download failed: HTTP ${downloadRes.status}`,
      }
    }

    const tempPath = `${targetPath}.download`
    await rm(tempPath, { force: true })
    await pipeline(
      Readable.fromWeb(downloadRes.body as import('stream/web').ReadableStream),
      createWriteStream(tempPath),
    )

    if (overwrite) {
      await rm(targetPath, { force: true })
    }
    await rename(tempPath, targetPath)
    if (process.platform !== 'win32') {
      await chmod(targetPath, 0o755)
    }

    return {
      ok: true,
      binaryPath: targetPath,
      releaseTag: release.tag_name || release.name || 'latest',
      assetName,
      overwritten: overwrite && alreadyExists,
    }
  } catch (error) {
    const err = error as Error & { code?: string }
    await rm(`${targetPath}.download`, { force: true }).catch(() => undefined)
    return {
      ok: false,
      code:
        err.code === 'NO_RELEASE_ASSET' || err.code === 'AMBIGUOUS_RELEASE_ASSET'
          ? err.code
          : 'DOWNLOAD_FAILED',
      error: err.message,
    }
  }
}
