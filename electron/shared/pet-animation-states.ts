export type PetAnimationStateId =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'

export interface PetAnimationStateDef {
  id: PetAnimationStateId
  row: number
  frames: number
  durationsMs: readonly number[]
}

/** Codex / Petdex 默认 9 行动画状态 */
export const DEFAULT_PET_ANIMATION_STATES: readonly PetAnimationStateDef[] = [
  { id: 'idle', row: 0, frames: 6, durationsMs: [280, 110, 110, 140, 140, 320] },
  { id: 'running-right', row: 1, frames: 8, durationsMs: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'running-left', row: 2, frames: 8, durationsMs: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'waving', row: 3, frames: 4, durationsMs: [140, 140, 140, 280] },
  { id: 'jumping', row: 4, frames: 5, durationsMs: [140, 140, 140, 140, 280] },
  { id: 'failed', row: 5, frames: 8, durationsMs: [140, 140, 140, 140, 140, 140, 140, 240] },
  { id: 'waiting', row: 6, frames: 6, durationsMs: [150, 150, 150, 150, 150, 260] },
  { id: 'running', row: 7, frames: 6, durationsMs: [120, 120, 120, 120, 120, 220] },
  { id: 'review', row: 8, frames: 6, durationsMs: [150, 150, 150, 150, 150, 280] },
] as const

export const DEFAULT_PET_ANIMATION_STATE_ID: PetAnimationStateId = 'idle'
export const PET_RANDOM_STATE_INTERVAL_MS = 10_000

const STATE_ID_SET = new Set<string>(DEFAULT_PET_ANIMATION_STATES.map((s) => s.id))

export function isPetAnimationStateId(value: string): value is PetAnimationStateId {
  return STATE_ID_SET.has(value)
}

export function normalizePetAnimationStateId(
  stored: string | null | undefined,
  availableIds?: readonly string[],
): PetAnimationStateId {
  const pool = availableIds?.length
    ? availableIds.filter(isPetAnimationStateId)
    : DEFAULT_PET_ANIMATION_STATES.map((s) => s.id)
  if (typeof stored === 'string' && pool.includes(stored as PetAnimationStateId)) {
    return stored as PetAnimationStateId
  }
  if (pool.includes(DEFAULT_PET_ANIMATION_STATE_ID)) return DEFAULT_PET_ANIMATION_STATE_ID
  return (pool[0] as PetAnimationStateId | undefined) ?? DEFAULT_PET_ANIMATION_STATE_ID
}

export function cloneDefaultPetAnimationStates(): PetAnimationStateDef[] {
  return DEFAULT_PET_ANIMATION_STATES.map((s) => ({
    ...s,
    durationsMs: [...s.durationsMs],
  }))
}

export function findPetAnimationState(
  states: readonly PetAnimationStateDef[],
  id: PetAnimationStateId,
): PetAnimationStateDef {
  return states.find((s) => s.id === id) ?? states[0] ?? DEFAULT_PET_ANIMATION_STATES[0]
}
