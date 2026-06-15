/** Session id entropy pool offsets. */
export const SESSION_ENTROPY_OFFSETS = [127, 21, 101] as const

export function randomUUID(): string {
  return crypto.randomUUID()
}
