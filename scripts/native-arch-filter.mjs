import { Arch, archFromString } from 'builder-util'

/** electron-builder PackContext.electronPlatformName 实际为 node 平台名（如 win32），非配置键 windows */
function normalizePlatform(platform) {
  switch (String(platform).toLowerCase()) {
    case 'win32':
    case 'windows':
    case 'win':
      return 'windows'
    case 'darwin':
    case 'mac':
    case 'macos':
      return 'mac'
    case 'linux':
      return 'linux'
    default:
      return String(platform).toLowerCase()
  }
}

function normalizeArch(arch) {
  if (typeof arch === 'number') return arch
  if (typeof arch === 'string') return archFromString(arch)
  return archFromString(process.arch)
}

/**
 * 按 electron-builder 目标平台/架构，返回应保留的原生产物标识。
 * @param {string} platform electronPlatformName（常见为 win32 / darwin / linux）
 * @param {number | string} arch builder-util Arch 枚举或 arch 字符串
 */
export function getNativeKeepSets(platform, arch) {
  platform = normalizePlatform(platform)
  arch = normalizeArch(arch)
  /** @type {Set<string>} */
  const nodePtyPrebuilds = new Set()
  /** @type {Set<string>} */
  const nodePtyConpty = new Set()
  /** @type {Set<string> | null} */
  let nodeScreenshots = null

  if (arch === Arch.universal) {
    if (platform === 'mac') {
      nodePtyPrebuilds.add('darwin-x64').add('darwin-arm64')
      nodeScreenshots = new Set(['node-screenshots-darwin-x64', 'node-screenshots-darwin-arm64'])
    } else if (platform === 'windows') {
      nodePtyPrebuilds.add('win32-x64').add('win32-arm64')
      nodePtyConpty.add('win10-x64').add('win10-arm64')
    }
    return { nodePtyPrebuilds, nodePtyConpty, nodeScreenshots }
  }

  if (platform === 'windows') {
    if (arch === Arch.x64 || arch === Arch.ia32) {
      nodePtyPrebuilds.add('win32-x64')
      nodePtyConpty.add('win10-x64')
    } else if (arch === Arch.arm64) {
      nodePtyPrebuilds.add('win32-arm64')
      nodePtyConpty.add('win10-arm64')
    }
    nodeScreenshots = new Set([
      arch === Arch.arm64
        ? 'node-screenshots-win32-arm64-msvc'
        : arch === Arch.ia32
          ? 'node-screenshots-win32-ia32-msvc'
          : 'node-screenshots-win32-x64-msvc',
    ])
  } else if (platform === 'mac') {
    if (arch === Arch.x64) {
      nodePtyPrebuilds.add('darwin-x64')
      nodeScreenshots = new Set(['node-screenshots-darwin-x64'])
    } else if (arch === Arch.arm64) {
      nodePtyPrebuilds.add('darwin-arm64')
      nodeScreenshots = new Set(['node-screenshots-darwin-arm64'])
    }
  } else if (platform === 'linux') {
    // node-pty linux 走 build/Release，prebuilds 与 Windows conpty 均不需要
    if (arch === Arch.x64) {
      nodeScreenshots = new Set([
        'node-screenshots-linux-x64-gnu',
        'node-screenshots-linux-x64-musl',
      ])
    } else if (arch === Arch.arm64) {
      nodeScreenshots = new Set(['node-screenshots-linux-arm64-gnu'])
    }
  }

  return { nodePtyPrebuilds, nodePtyConpty, nodeScreenshots }
}
