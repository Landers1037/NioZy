/**
 * 从 jgraph/drawio Release 解压 webapp 到 public/drawio（离线 embed）
 */
import { createWriteStream, existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { execSync } from 'child_process'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dest = resolve(root, 'public/drawio')
const DRAWIO_VERSION = '26.0.9'
const marker = resolve(dest, '.vendor-version')

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

function findWebappDir(extractedRoot) {
  const direct = join(extractedRoot, 'src', 'main', 'webapp')
  if (existsSync(join(direct, 'index.html'))) return direct
  const entries = readdirSync(extractedRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = join(extractedRoot, entry.name, 'src', 'main', 'webapp')
    if (existsSync(join(nested, 'index.html'))) return nested
  }
  return null
}

async function main() {
  if (existsSync(marker)) {
    const version = await import('fs').then((fs) => fs.readFileSync(marker, 'utf8').trim())
    if (version === DRAWIO_VERSION && existsSync(join(dest, 'index.html'))) {
      console.log(`[vendor-drawio] 已存在 v${DRAWIO_VERSION}，跳过`)
      return
    }
  }

  const tmpDir = resolve(root, '.tmp-drawio-vendor')
  const zipPath = join(tmpDir, `drawio-${DRAWIO_VERSION}.zip`)
  const extractDir = join(tmpDir, 'extract')
  mkdirSync(tmpDir, { recursive: true })

  const url = `https://github.com/jgraph/drawio/archive/refs/tags/v${DRAWIO_VERSION}.zip`
  console.log(`[vendor-drawio] 下载 ${url}`)
  await download(url, zipPath)

  if (existsSync(extractDir)) rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })

  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' },
    )
  } else {
    execSync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' })
  }

  const webapp = findWebappDir(extractDir)
  if (!webapp) {
    console.error('[vendor-drawio] 无法在压缩包中找到 src/main/webapp')
    process.exit(1)
  }

  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(webapp, dest, { recursive: true })
  await import('fs').then((fs) =>
    fs.writeFileSync(marker, DRAWIO_VERSION, 'utf8'),
  )

  rmSync(tmpDir, { recursive: true, force: true })
  console.log(`[vendor-drawio] 已安装 v${DRAWIO_VERSION} 到 ${dest}`)
}

main().catch((err) => {
  console.error('[vendor-drawio] 失败:', err)
  process.exit(1)
})
