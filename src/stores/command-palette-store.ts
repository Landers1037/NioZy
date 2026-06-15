import { create } from 'zustand'
import type { CommandPaletteCommandId } from '@/lib/command-palette-commands'

const RECENT_KEY = 'niozy.commandPalette.recent'
const RECENT_LIMIT = 3

interface RecentEntry {
  id: CommandPaletteCommandId
  count: number
  lastUsed: number
}

function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecent(entries: RecentEntry[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, RECENT_LIMIT * 4)))
  } catch {
    // ignore quota errors
  }
}

export function getRecentCommandIds(): CommandPaletteCommandId[] {
  return readRecent()
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, RECENT_LIMIT)
    .map((e) => e.id)
}

export function recordCommandUsage(id: CommandPaletteCommandId): void {
  const now = Date.now()
  const entries = readRecent()
  const existing = entries.find((e) => e.id === id)
  if (existing) {
    existing.count += 1
    existing.lastUsed = now
  } else {
    entries.push({ id, count: 1, lastUsed: now })
  }
  writeRecent(entries)
}

interface CommandPaletteState {
  open: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
  togglePalette: () => set((s) => ({ open: !s.open })),
}))
