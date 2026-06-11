/**
 * 下载 Oh My Posh 可执行文件、内置主题与 posh-git 模块到 vendor/（离线打包用）
 *
 * 用法: npm run vendor:oh-my-posh
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  readdirSync,
} from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { execSync } from 'child_process'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const OH_MY_POSH_VERSION = '26.1.0'
const POSH_GIT_VERSION = 'v1.1.0'

const themesJson = JSON.parse(
  readFileSync(resolve(root, 'electron/shared/oh-my-posh-themes.json'), 'utf8'),
)

const ompDir = resolve(root, 'vendor/oh-my-posh')
const ompThemesDir = join(ompDir, 'themes')
const poshGitDir = resolve(root, 'vendor/posh-git')
const marker = join(ompDir, '.vendor-version')

function download(url, destPath) {
  return new Promise((resolvePromise, reject) => {
    const file = createWriteStream(destPath)
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          download(res.headers.location, destPath).then(resolvePromise).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        pipeline(res, file).then(resolvePromise).catch(reject)
      })
      .on('error', reject)
  })
}

function findPoshGitModuleRoot(extractedRoot) {
  const entries = readdirSync(extractedRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const repoRoot = join(extractedRoot, entry.name)
    const srcModule = join(repoRoot, 'src', 'posh-git.psd1')
    if (existsSync(srcModule)) return join(repoRoot, 'src')
    const direct = join(repoRoot, 'posh-git.psd1')
    if (existsSync(direct)) return repoRoot
  }
  return null
}

function allThemesPresent() {
  return themesJson.every((theme) => existsSync(join(ompThemesDir, theme.file)))
}

async function vendorOhMyPosh() {
  mkdirSync(ompThemesDir, { recursive: true })

  const exePath = join(ompDir, 'oh-my-posh.exe')
  const ompUrl = `https://github.com/JanDeDobbeleer/oh-my-posh/releases/download/v${OH_MY_POSH_VERSION}/posh-windows-amd64.exe`

  console.log(`[vendor-oh-my-posh] 下载 Oh My Posh v${OH_MY_POSH_VERSION}…`)
  await download(ompUrl, exePath)

  console.log(`[vendor-oh-my-posh] 下载 ${themesJson.length} 个主题…`)
  for (const theme of themesJson) {
    const themePath = join(ompThemesDir, theme.file)
    const themeUrl = `https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/v${OH_MY_POSH_VERSION}/themes/${theme.file}`
    console.log(`  - ${theme.file}`)
    await download(themeUrl, themePath)
  }
}

async function vendorPoshGit() {
  const tmpDir = resolve(root, '.tmp-posh-git-vendor')
  const zipPath = join(tmpDir, `posh-git-${POSH_GIT_VERSION}.zip`)
  const extractDir = join(tmpDir, 'extract')
  const zipUrl = `https://github.com/dahlbyk/posh-git/archive/refs/tags/${POSH_GIT_VERSION}.zip`

  mkdirSync(tmpDir, { recursive: true })
  if (existsSync(extractDir)) rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })

  console.log(`[vendor-oh-my-posh] 下载 posh-git ${POSH_GIT_VERSION}…`)
  await download(zipUrl, zipPath)

  console.log('[vendor-oh-my-posh] 解压 posh-git…')
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
    { stdio: 'inherit' },
  )

  const moduleRoot = findPoshGitModuleRoot(extractDir)
  if (!moduleRoot) {
    throw new Error('posh-git 解压后未找到 posh-git.psd1')
  }

  if (existsSync(poshGitDir)) rmSync(poshGitDir, { recursive: true, force: true })
  cpSync(moduleRoot, poshGitDir, { recursive: true })
  rmSync(tmpDir, { recursive: true, force: true })
}

async function main() {
  const versionTag = `${OH_MY_POSH_VERSION}+${POSH_GIT_VERSION}+themes:${themesJson.length}`
  if (existsSync(marker)) {
    const current = readFileSync(marker, 'utf8').trim()
    const exeOk = existsSync(join(ompDir, 'oh-my-posh.exe'))
    const gitOk = existsSync(join(poshGitDir, 'posh-git.psd1'))
    if (current === versionTag && exeOk && gitOk && allThemesPresent()) {
      console.log(`[vendor-oh-my-posh] 已存在 ${versionTag}，跳过`)
      return
    }
  }

  await vendorOhMyPosh()
  await vendorPoshGit()
  writeFileSync(marker, `${versionTag}\n`, 'utf8')
  console.log('[vendor-oh-my-posh] 完成')
  console.log(`  ${join(ompDir, 'oh-my-posh.exe')}`)
  console.log(`  ${ompThemesDir} (${themesJson.length} themes)`)
  console.log(`  ${join(poshGitDir, 'posh-git.psd1')}`)
}

main().catch((err) => {
  console.error('[vendor-oh-my-posh] 失败:', err)
  process.exit(1)
})
