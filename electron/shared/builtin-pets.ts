export const DEFAULT_BUILTIN_PET_ID = 'NioZzzzy'

export const BUILTIN_PET_IDS = [DEFAULT_BUILTIN_PET_ID] as const

export type BuiltinPetId = (typeof BUILTIN_PET_IDS)[number]

export function isBuiltinPetId(petId: string): petId is BuiltinPetId {
  return BUILTIN_PET_IDS.includes(petId as BuiltinPetId)
}
