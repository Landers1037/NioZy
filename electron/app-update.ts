import { app, shell } from 'electron'
import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import {
  GITHUB_RELEASES_URL,
  INSTALLER_BASENAME,
} from './shared/app-release'
import {
  githubReleasesApiUrl,
  parseGithubRepoFromReleasesUrl,
} from './shared/github-repo'
import { updateLog } from './app-log'
import {
  INSTALLER_FILENAME_PATTERN,
  isNewerVersion,
  parseVersion,
  pickLatestVersion,
} from './shared/version'

const GITHUB_USER_AGENT = 'NioZy-Updater'

export interface UpdateCheckResult {
  ok: boolean
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  downloadUrl?: string
  error?: string
}

export interface UpdateDownloadResult {
  ok: boolean
  installerPath?: string
  error?: string
}

interface InstallerRelease {
  version: string
  downloadUrl: string
  fileName: string
}

interface GithubReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GithubRelease {
  tag_name?: string
  name?: string
  assets?: GithubReleaseAsset[]
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

function collectInstallerReleases(releases: GithubRelease[]): InstallerRelease[] {
  const found: InstallerRelease[] = []

  for (const release of releases) {
    const tagVersion = release.tag_name ? parseVersion(release.tag_name) : null
    const nameVersion = release.name ? parseVersion(release.name) : null

    for (const asset of release.assets ?? []) {
      const fileName = asset.name ?? ''
      const match = fileName.match(INSTALLER_FILENAME_PATTERN)
      if (!match || !asset.browser_download_url) continue

      const version = match[1]!
      found.push({
        version,
        downloadUrl: asset.browser_download_url,
        fileName,
      })
    }

    const fallbackVersion = tagVersion ?? nameVersion
    if (fallbackVersion && !found.some((r) => r.version === fallbackVersion)) {
      const expectedName = INSTALLER_BASENAME(fallbackVersion)
      const asset = release.assets?.find((a) => a.name === expectedName)
      if (asset?.browser_download_url) {
        found.push({
          version: fallbackVersion,
          downloadUrl: asset.browser_download_url,
          fileName: expectedName,
        })
      }
    }
  }

  return found
}

async function fetchReleaseInstallers(): Promise<InstallerRelease[]> {
  const repo = parseGithubRepoFromReleasesUrl(GITHUB_RELEASES_URL)
  if (!repo) {
    throw new Error('Invalid GITHUB_RELEASES_URL')
  }

  const apiUrl = githubReleasesApiUrl(repo.owner, repo.repo)
  updateLog.debug('Checking GitHub releases', { apiUrl })
  const res = await githubFetch(apiUrl)
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
  }

  const releases = (await res.json()) as GithubRelease[]
  if (!Array.isArray(releases)) {
    throw new Error('Unexpected GitHub releases response')
  }

  return collectInstallerReleases(releases)
}

function findLatestInstaller(
  installers: InstallerRelease[],
  currentVersion: string,
): InstallerRelease | null {
  const versions = installers.map((i) => i.version)
  const latestVersion = pickLatestVersion(versions)
  if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) return null

  const matches = installers.filter((i) => i.version === latestVersion)
  return matches[0] ?? null
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const installers = await fetchReleaseInstallers()
    const latest = findLatestInstaller(installers, currentVersion)

    if (!latest) {
      return { ok: true, hasUpdate: false, currentVersion }
    }

    return {
      ok: true,
      hasUpdate: true,
      currentVersion,
      latestVersion: latest.version,
      downloadUrl: latest.downloadUrl,
    }
  } catch (error) {
    return {
      ok: false,
      hasUpdate: false,
      currentVersion,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function downloadAndInstallUpdate(
  downloadUrl: string,
  version: string,
): Promise<UpdateDownloadResult> {
  const fileName = INSTALLER_BASENAME(version)
  const destDir = join(app.getPath('temp'), 'niozy-updates')
  const destPath = join(destDir, fileName)

  try {
    await mkdir(destDir, { recursive: true })

    const res = await githubFetch(downloadUrl)
    if (!res.ok || !res.body) {
      throw new Error(`Download failed: HTTP ${res.status}`)
    }

    await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), createWriteStream(destPath))

    const openError = await shell.openPath(destPath)
    if (openError) {
      throw new Error(openError)
    }

    return { ok: true, installerPath: destPath }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
