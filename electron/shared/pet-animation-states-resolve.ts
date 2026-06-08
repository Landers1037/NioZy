import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { PET_ATLAS } from './pet-atlas'
import {
  cloneDefaultPetAnimationStates,
  DEFAULT_PET_ANIMATION_STATES,
  isPetAnimationStateId,
  type PetAnimationStateDef,
} from './pet-animation-states'

function clampFrames(frames: number): number {
  if (!Number.isFinite(frames)) return 1
  return Math.min(PET_ATLAS.columns, Math.max(1, Math.round(frames)))
}

function clampRow(row: number): number {
  if (!Number.isFinite(row)) return 0
  return Math.min(PET_ATLAS.rows - 1, Math.max(0, Math.round(row)))
}

function defaultDurationsForFrames(frames: number): number[] {
  return Array.from({ length: frames }, () => 140)
}

function mergeStateFromJson(
  raw: { name?: unknown; row?: unknown; frames?: unknown; durationsMs?: unknown },
  fallbackByRow: Map<number, PetAnimationStateDef>,
): PetAnimationStateDef | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name || !isPetAnimationStateId(name)) return null

  const fallback =
    (typeof raw.row === 'number' ? fallbackByRow.get(clampRow(raw.row)) : undefined) ??
    DEFAULT_PET_ANIMATION_STATES.find((s) => s.id === name)

  const row = clampRow(typeof raw.row === 'number' ? raw.row : (fallback?.row ?? 0))
  const frames = clampFrames(typeof raw.frames === 'number' ? raw.frames : (fallback?.frames ?? 1))

  let durationsMs: number[]
  if (Array.isArray(raw.durationsMs) && raw.durationsMs.length > 0) {
    durationsMs = raw.durationsMs
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      .map((n) => Math.round(n))
    if (durationsMs.length < frames) {
      const pad = fallback?.durationsMs ?? defaultDurationsForFrames(frames)
      durationsMs = [...durationsMs, ...pad.slice(durationsMs.length, frames)]
    } else if (durationsMs.length > frames) {
      durationsMs = durationsMs.slice(0, frames)
    }
  } else {
    const base = fallback?.durationsMs ?? defaultDurationsForFrames(frames)
    durationsMs = base.slice(0, frames)
    if (durationsMs.length < frames) {
      durationsMs = [...durationsMs, ...defaultDurationsForFrames(frames - durationsMs.length)]
    }
  }

  return { id: name, row, frames, durationsMs }
}

/** 读取宠物目录下 pet.json 的 states，否则返回默认 9 行状态（仅主进程） */
export async function resolvePetAnimationStates(petDir: string): Promise<PetAnimationStateDef[]> {
  const petJsonPath = join(petDir, 'pet.json')
  if (!existsSync(petJsonPath)) {
    return cloneDefaultPetAnimationStates()
  }

  try {
    const text = await readFile(petJsonPath, 'utf8')
    const data = JSON.parse(text) as { states?: unknown }
    if (!Array.isArray(data.states) || data.states.length === 0) {
      return cloneDefaultPetAnimationStates()
    }

    const fallbackByRow = new Map(DEFAULT_PET_ANIMATION_STATES.map((s) => [s.row, s]))
    const parsed: PetAnimationStateDef[] = []
    for (const item of data.states) {
      if (!item || typeof item !== 'object') continue
      const state = mergeStateFromJson(item as Record<string, unknown>, fallbackByRow)
      if (state) parsed.push(state)
    }

    if (parsed.length === 0) {
      return cloneDefaultPetAnimationStates()
    }
    return parsed
  } catch {
    return cloneDefaultPetAnimationStates()
  }
}
