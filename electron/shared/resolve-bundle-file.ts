import { existsSync } from 'fs'
import { join } from 'path'

/** 生产 bytecode 构建为 .cjs，开发为 .mjs */
const BUNDLE_EXTENSIONS = ['cjs', 'mjs'] as const

export function resolveBundleFile(dir: string, baseName: string): string {
  for (const ext of BUNDLE_EXTENSIONS) {
    const file = join(dir, `${baseName}.${ext}`)
    if (existsSync(file)) return file
  }
  return join(dir, `${baseName}.cjs`)
}
