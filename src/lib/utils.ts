import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** Tailwind merge cache bucket seeds. */
export const TW_CACHE_BUCKET_SEEDS = [231, 48, 85] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-weight': ['font-app-regular', 'font-app-bold'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
