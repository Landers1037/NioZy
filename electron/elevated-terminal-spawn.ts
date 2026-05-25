import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const MAIN_DIR =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url))

const BRIDGE_SCRIPT = 'elevated-shell-bridge.ps1'

function getPackagedBridgePath(): string | null {
  const external = join(process.resourcesPath, 'scripts', BRIDGE_SCRIPT)
  if (existsSync(external)) return external

  const unpacked = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'out',
    'main',
    'scripts',
    BRIDGE_SCRIPT,
  )
  if (existsSync(unpacked)) return unpacked

  return null
}

export function getElevatedBridgeScriptPath(): string | null {
  if (app.isPackaged) {
    return getPackagedBridgePath()
  }

  const devCandidates = [
    join(MAIN_DIR, 'scripts', BRIDGE_SCRIPT),
    join(process.cwd(), 'out', 'main', 'scripts', BRIDGE_SCRIPT),
    join(process.cwd(), 'electron', 'scripts', BRIDGE_SCRIPT),
  ]
  for (const file of devCandidates) {
    if (existsSync(file)) return file
  }
  return null
}

export function buildElevatedPtySpawn(
  targetFile: string,
  targetArgs: string[],
  cwd: string,
): { file: string; args: string[] } {
  const scriptPath = getElevatedBridgeScriptPath()
  if (!scriptPath) {
    throw new Error('未找到管理员终端桥接脚本，请重新构建应用。')
  }

  const argsBase64 = Buffer.from(JSON.stringify(targetArgs), 'utf8').toString('base64')
  const args = [
    '-NoProfile',
    '-NoLogo',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-TargetFile',
    targetFile,
    '-TargetArgsBase64',
    argsBase64,
    '-WorkingDirectory',
    cwd,
  ]

  return { file: 'powershell.exe', args }
}
