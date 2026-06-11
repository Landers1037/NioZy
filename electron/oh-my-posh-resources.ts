import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_OH_MY_POSH_THEME,
  getOhMyPoshThemeFile,
  normalizeOhMyPoshTheme,
  type OhMyPoshThemeId,
} from './shared/oh-my-posh-themes'

const MAIN_DIR =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url))

const OMP_BOOTSTRAP_SCRIPT = 'omp-bootstrap.ps1'
const OH_MY_POSH_EXE = 'oh-my-posh.exe'
const POSH_GIT_MODULE = 'posh-git.psd1'

export interface OhMyPoshBundledResources {
  bootstrapScript: string
  exe: string
  config: string
  poshGitModule: string
}

function getOhMyPoshRoots(): string[] {
  if (app.isPackaged) {
    return [join(process.resourcesPath, 'oh-my-posh')]
  }
  return [
    join(process.cwd(), 'vendor', 'oh-my-posh'),
    join(MAIN_DIR, '..', 'vendor', 'oh-my-posh'),
  ]
}

function getPoshGitModulePath(): string | null {
  const roots = app.isPackaged
    ? [join(process.resourcesPath, 'posh-git')]
    : [join(process.cwd(), 'vendor', 'posh-git'), join(MAIN_DIR, '..', 'vendor', 'posh-git')]
  for (const root of roots) {
    const modulePath = join(root, POSH_GIT_MODULE)
    if (existsSync(modulePath)) return modulePath
  }
  return null
}

function resolveThemeConfigPath(themeId: OhMyPoshThemeId): string {
  const normalized = normalizeOhMyPoshTheme(themeId)
  const themeFile = getOhMyPoshThemeFile(normalized)
  const fallbackFile = getOhMyPoshThemeFile(DEFAULT_OH_MY_POSH_THEME)

  for (const root of getOhMyPoshRoots()) {
    const selected = join(root, 'themes', themeFile)
    if (existsSync(selected)) return selected
    const fallback = join(root, 'themes', fallbackFile)
    if (existsSync(fallback)) return fallback
  }
  return ''
}

function getPackagedOmpBootstrapPath(): string | null {
  const external = join(process.resourcesPath, OMP_BOOTSTRAP_SCRIPT)
  if (existsSync(external)) return external

  const unpacked = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'out',
    'main',
    'scripts',
    OMP_BOOTSTRAP_SCRIPT,
  )
  if (existsSync(unpacked)) return unpacked

  return null
}

function getDevOmpBootstrapPath(): string | null {
  const candidates = [
    join(MAIN_DIR, 'scripts', OMP_BOOTSTRAP_SCRIPT),
    join(process.cwd(), 'out', 'main', 'scripts', OMP_BOOTSTRAP_SCRIPT),
    join(process.cwd(), 'electron', 'scripts', OMP_BOOTSTRAP_SCRIPT),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return null
}

export function getOmpBootstrapScriptPath(): string | null {
  if (app.isPackaged) {
    return getPackagedOmpBootstrapPath()
  }
  return getDevOmpBootstrapPath()
}

function getOhMyPoshExePath(): string | null {
  for (const root of getOhMyPoshRoots()) {
    const exe = join(root, OH_MY_POSH_EXE)
    if (existsSync(exe)) return exe
  }
  return null
}

/** 内置资源齐全时返回路径；缺失任一关键文件则返回 null（优雅降级） */
export function getOhMyPoshBundledResources(themeId?: OhMyPoshThemeId): OhMyPoshBundledResources | null {
  const bootstrapScript = getOmpBootstrapScriptPath()
  const exe = getOhMyPoshExePath()
  const poshGitModule = getPoshGitModulePath()
  if (!bootstrapScript || !exe || !poshGitModule) return null

  return {
    bootstrapScript,
    exe,
    config: resolveThemeConfigPath(themeId ?? DEFAULT_OH_MY_POSH_THEME),
    poshGitModule,
  }
}
