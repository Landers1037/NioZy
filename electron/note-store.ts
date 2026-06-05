import { existsSync, readFileSync, writeFileSync } from 'fs'
import { ensureConfigDir, getNoteFilePath } from './config-paths'
import type { NoteItem } from './shared/note-types'

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeNoteItem(value: unknown): NoteItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const id = typeof raw.id === 'string' ? raw.id : ''
  if (!id.trim()) return null
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  }
}

function normalizeNoteList(value: unknown): NoteItem[] {
  if (!Array.isArray(value)) return []
  const out: NoteItem[] = []
  for (const item of value) {
    const n = normalizeNoteItem(item)
    if (n) out.push(n)
  }
  return out
}

export class NoteStore {
  private path = getNoteFilePath()

  list(): NoteItem[] {
    ensureConfigDir()
    this.path = getNoteFilePath()
    if (!existsSync(this.path)) return []
    const parsed = safeParseJson(readFileSync(this.path, 'utf-8'))
    return normalizeNoteList(parsed)
  }

  save(input: { id?: string; title?: string; content?: string }): NoteItem {
    const items = this.list()
    const now = nowIso()
    const id =
      typeof input.id === 'string' && input.id.trim()
        ? input.id.trim()
        : `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const title = typeof input.title === 'string' ? input.title : ''
    const content = typeof input.content === 'string' ? input.content : ''

    const existingIndex = items.findIndex((n) => n.id === id)
    if (existingIndex >= 0) {
      const prev = items[existingIndex]!
      const next: NoteItem = {
        ...prev,
        title,
        content,
        updatedAt: now,
      }
      items.splice(existingIndex, 1, next)
      this.persist(items)
      return next
    }

    const created: NoteItem = { id, title, content, createdAt: now, updatedAt: now }
    items.unshift(created)
    this.persist(items)
    return created
  }

  delete(id: string): void {
    const trimmed = typeof id === 'string' ? id.trim() : ''
    if (!trimmed) return
    const items = this.list().filter((n) => n.id !== trimmed)
    this.persist(items)
  }

  private persist(items: NoteItem[]): void {
    ensureConfigDir()
    this.path = getNoteFilePath()
    writeFileSync(this.path, JSON.stringify(items, null, 2), 'utf-8')
  }
}

