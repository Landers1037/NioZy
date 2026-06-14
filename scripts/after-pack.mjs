import { readdirSync, rmSync } from 'fs'
import { join } from 'path'

/**
 * 打包后清理 Chromium locales 目录，只保留 zh / en / ja 相关语言包
 * 文件名示例：zh-CN.pak, zh-TW.pak, en-US.pak, en-GB.pak, ja.pak
 */
const KEEP_PREFIXES = ['zh', 'en', 'ja']

export default function afterPack(context) {
  const localesDir = join(context.appOutDir, 'locales')

  let files
  try {
    files = readdirSync(localesDir)
  } catch {
    // locales 目录不存在时忽略（某些平台可能路径不同）
    return
  }

  let removed = 0
  for (const file of files) {
    if (!file.endsWith('.pak')) continue
    const name = file.replace(/\.pak$/, '')
    const keep = KEEP_PREFIXES.some(
      (prefix) => name === prefix || name.startsWith(prefix + '-'),
    )
    if (!keep) {
      rmSync(join(localesDir, file))
      removed++
    }
  }

  if (removed > 0) {
    console.log(`[after-pack] 已清理 ${removed} 个多余的 locale 文件，保留前缀：${KEEP_PREFIXES.join(', ')}`)
  }
}
