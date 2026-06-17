import { existsSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { getNativeKeepSets } from './native-arch-filter.mjs'

/**
 * 打包后清理 Chromium locales 目录，只保留 zh / en / ja 相关语言包
 * 文件名示例：zh-CN.pak, zh-TW.pak, en-US.pak, en-GB.pak, ja.pak
 */
const KEEP_LOCALE_PREFIXES = ['zh', 'en', 'ja']

function pruneLocales(appOutDir) {
  const localesDir = join(appOutDir, 'locales')

  let files
  try {
    files = readdirSync(localesDir)
  } catch {
    return
  }

  let removed = 0
  for (const file of files) {
    if (!file.endsWith('.pak')) continue
    const name = file.replace(/\.pak$/, '')
    const keep = KEEP_LOCALE_PREFIXES.some(
      (prefix) => name === prefix || name.startsWith(prefix + '-'),
    )
    if (!keep) {
      rmSync(join(localesDir, file))
      removed++
    }
  }

  if (removed > 0) {
    console.log(
      `[after-pack] 已清理 ${removed} 个多余的 locale 文件，保留前缀：${KEEP_LOCALE_PREFIXES.join(', ')}`,
    )
  }
}

function pruneNodePty(nodeModulesDir, keep) {
  const nodePtyDir = join(nodeModulesDir, 'node-pty')
  if (!existsSync(nodePtyDir)) return

  const prebuildsDir = join(nodePtyDir, 'prebuilds')
  if (existsSync(prebuildsDir)) {
    for (const entry of readdirSync(prebuildsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || keep.nodePtyPrebuilds.has(entry.name)) continue
      rmSync(join(prebuildsDir, entry.name), { recursive: true, force: true })
      console.log(`[after-pack] 已移除 node-pty prebuild: ${entry.name}`)
    }
  }

  const conptyRoot = join(nodePtyDir, 'third_party', 'conpty')
  if (existsSync(conptyRoot)) {
    if (keep.nodePtyConpty.size === 0) {
      rmSync(conptyRoot, { recursive: true, force: true })
      console.log('[after-pack] 已移除 node-pty third_party/conpty（非 Windows 目标）')
    } else {
      for (const versionDir of readdirSync(conptyRoot, { withFileTypes: true })) {
        if (!versionDir.isDirectory()) continue
        const versionPath = join(conptyRoot, versionDir.name)
        for (const entry of readdirSync(versionPath, { withFileTypes: true })) {
          if (!entry.isDirectory() || keep.nodePtyConpty.has(entry.name)) continue
          rmSync(join(versionPath, entry.name), { recursive: true, force: true })
          console.log(`[after-pack] 已移除 node-pty conpty: ${versionDir.name}/${entry.name}`)
        }
      }
    }
  }

  // 有 prebuilds 时移除本机 build 产物，避免 loadNativeModule 优先加载错误架构
  if (keep.nodePtyPrebuilds.size > 0) {
    for (const buildDir of ['build', 'build/Release', 'build/Debug']) {
      const path = join(nodePtyDir, buildDir)
      if (!existsSync(path)) continue
      rmSync(path, { recursive: true, force: true })
      console.log(`[after-pack] 已移除 node-pty/${buildDir}`)
    }
  }
}

function pruneNodeScreenshots(nodeModulesDir, keep) {
  if (keep.nodeScreenshots === null) return

  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('node-screenshots-')) continue
    if (keep.nodeScreenshots.has(entry.name)) continue
    rmSync(join(nodeModulesDir, entry.name), { recursive: true, force: true })
    console.log(`[after-pack] 已移除 ${entry.name}`)
  }
}

function pruneNativeArchBinaries(appOutDir, platform, arch) {
  const nodeModulesDir = join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules')
  if (!existsSync(nodeModulesDir)) return

  const keep = getNativeKeepSets(platform, arch)
  if (keep.nodePtyPrebuilds.size === 0 && keep.nodePtyConpty.size === 0) {
    console.warn(
      `[after-pack] 未识别目标平台/架构 (${platform}/${arch})，跳过 node-pty 裁剪`,
    )
    pruneNodeScreenshots(nodeModulesDir, keep)
    return
  }
  pruneNodePty(nodeModulesDir, keep)
  pruneNodeScreenshots(nodeModulesDir, keep)
}

export default function afterPack(context) {
  pruneLocales(context.appOutDir)
  pruneNativeArchBinaries(
    context.appOutDir,
    context.electronPlatformName,
    context.arch,
  )
}
