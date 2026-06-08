import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, join } from 'path'
import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { ensureConfigDir, getPetDir, getPetsDir, getPetSpritesheetPath } from './config-paths'
import { buildLocalPreviewUrl } from './shared/local-file-url'
import {
  findPetAnimationState,
  normalizePetAnimationStateId,
  PET_RANDOM_STATE_INTERVAL_MS,
  type PetAnimationStateDef,
} from './shared/pet-animation-states'
import { resolvePetAnimationStates } from './shared/pet-animation-states-resolve'

export const PET_SPRITESHEET_FILENAME = 'spritesheet.webp'

const PET_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export type PetImportResult =
  | { ok: true; id: string; url: string }
  | { ok: false; canceled?: boolean; error?: string }

export type PetDeleteResult = { ok: true } | { ok: false; error?: string }

export type PetAnimationStateDto = {
  id: string
  row: number
  frames: number
  durationsMs: number[]
}

export function sanitizePetId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || !PET_NAME_PATTERN.test(trimmed)) return null
  return trimmed
}

export async function ensurePetsDir(): Promise<string> {
  ensureConfigDir()
  const dir = getPetsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

export async function listPetIds(): Promise<string[]> {
  await ensurePetsDir()
  const entries = await readdir(getPetsDir(), { withFileTypes: true })
  const ids: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const sheetPath = getPetSpritesheetPath(entry.name)
    if (existsSync(sheetPath)) ids.push(entry.name)
  }
  return ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function petSpritesheetExists(petId: string): boolean {
  return existsSync(getPetSpritesheetPath(petId))
}

export function buildPetSpritesheetPreviewUrl(petId: string): string | null {
  if (!petSpritesheetExists(petId)) return null
  return buildLocalPreviewUrl(getPetSpritesheetPath(petId))
}

export async function nextDefaultPetId(): Promise<string> {
  const existing = new Set(await listPetIds())
  let n = 0
  while (existing.has(String(n))) n += 1
  return String(n)
}

async function resolveImportPetId(requestedName: string): Promise<string | { error: string }> {
  const trimmed = requestedName.trim()
  if (trimmed) {
    const sanitized = sanitizePetId(trimmed)
    if (!sanitized) return { error: 'INVALID_NAME' }
    if (petSpritesheetExists(sanitized)) return { error: 'NAME_EXISTS' }
    return sanitized
  }
  return nextDefaultPetId()
}

function isWebpFile(filePath: string): boolean {
  return basename(filePath).toLowerCase().endsWith('.webp')
}

export async function pickAndImportPet(
  mainWindow: BrowserWindow | null,
  requestedName: string,
): Promise<PetImportResult> {
  const openOptions = {
    title: '选择宠物精灵图',
    properties: ['openFile'] as ('openFile')[],
    filters: [
      { name: 'WebP 精灵图', extensions: ['webp'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  }
  const { canceled, filePaths } = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions)
  if (canceled || !filePaths[0]) return { ok: false, canceled: true }

  const sourcePath = filePaths[0]
  if (!isWebpFile(sourcePath)) {
    return { ok: false, error: 'NOT_WEBP' }
  }

  const petId = await resolveImportPetId(requestedName)
  if (typeof petId !== 'string') {
    return { ok: false, error: petId.error }
  }

  try {
    await ensurePetsDir()
    const petDir = join(getPetsDir(), petId)
    await mkdir(petDir, { recursive: true })
    const destPath = join(petDir, PET_SPRITESHEET_FILENAME)
    await copyFile(sourcePath, destPath)
    const st = await stat(destPath)
    if (!st.isFile() || st.size <= 0) {
      return { ok: false, error: 'COPY_FAILED' }
    }
    const url = buildPetSpritesheetPreviewUrl(petId)
    if (!url) return { ok: false, error: 'COPY_FAILED' }
    return { ok: true, id: petId, url }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function toPetAnimationStateDto(state: PetAnimationStateDef): PetAnimationStateDto {
  return {
    id: state.id,
    row: state.row,
    frames: state.frames,
    durationsMs: [...state.durationsMs],
  }
}

export async function listPetAnimationStates(petId: string): Promise<PetAnimationStateDto[]> {
  if (!petSpritesheetExists(petId)) return []
  const states = await resolvePetAnimationStates(getPetDir(petId))
  return states.map(toPetAnimationStateDto)
}

export async function deletePet(petId: string): Promise<PetDeleteResult> {
  const sanitized = sanitizePetId(petId)
  if (!sanitized || !petSpritesheetExists(sanitized)) {
    return { ok: false, error: 'NOT_FOUND' }
  }
  try {
    await rm(getPetDir(sanitized), { recursive: true, force: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function resolveActivePetId(
  storedId: string | null | undefined,
  availableIds: string[],
): string | null {
  if (availableIds.length === 0) return null
  if (typeof storedId === 'string' && availableIds.includes(storedId)) return storedId
  return availableIds[0] ?? null
}

export type DesktopPetSpriteConfig =
  | { mode: 'placeholder' }
  | {
      mode: 'sprite'
      spriteUrl: string
      petId: string
      animationStateId: string
      randomState: boolean
      randomIntervalMs: number
      states: PetAnimationStateDto[]
    }

export async function getDesktopPetSpriteConfig(
  desktopPetEnabled: boolean,
  desktopPetId: string | null | undefined,
  desktopPetAnimationState: string | null | undefined,
  desktopPetRandomState: boolean,
): Promise<DesktopPetSpriteConfig> {
  if (!desktopPetEnabled) return { mode: 'placeholder' }
  const ids = await listPetIds()
  const activeId = resolveActivePetId(desktopPetId, ids)
  if (!activeId) return { mode: 'placeholder' }
  const url = buildPetSpritesheetPreviewUrl(activeId)
  if (!url) return { mode: 'placeholder' }

  const states = await resolvePetAnimationStates(getPetDir(activeId))
  const stateIds = states.map((s) => s.id)
  const animationStateId = normalizePetAnimationStateId(desktopPetAnimationState, stateIds)
  findPetAnimationState(states, animationStateId)

  return {
    mode: 'sprite',
    spriteUrl: url,
    petId: activeId,
    animationStateId,
    randomState: desktopPetRandomState === true,
    randomIntervalMs: PET_RANDOM_STATE_INTERVAL_MS,
    states: states.map(toPetAnimationStateDto),
  }
}
