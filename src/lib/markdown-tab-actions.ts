import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { getElectronAPI } from '@/lib/electron-client'
import { useAppStore } from '@/stores/app-store'
import { useMarkdownEditorStore } from '@/stores/markdown-editor-store'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { randomUUID } from '@/lib/id'
import { basenameFromPath } from '@/components/markdown-editor/lib/markdown-file'
import { isMarkdownFilePath } from '../../electron/shared/markdown-file-limits'

export function findMarkdownTabByPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  const tab = useAppStore
    .getState()
    .tabs.find(
      (t) =>
        t.type === 'markdown' &&
        t.markdownFilePath?.replace(/\\/g, '/').toLowerCase() === normalized,
    )
  return tab?.id ?? null
}

export function openMarkdownTabWithContent(filePath: string, content: string, title?: string) {
  const existingId = findMarkdownTabByPath(filePath)
  if (existingId) {
    useMarkdownEditorStore
      .getState()
      .setContent(existingId, content, { dirty: false, persistedContent: content })
    useAppStore.getState().setActiveTab(existingId)
    return existingId
  }

  const tabId = `markdown-${randomUUID()}`
  useMarkdownEditorStore.getState().ensureSession(tabId)
  useMarkdownEditorStore
    .getState()
    .setContent(tabId, content, { dirty: false, persistedContent: content })

  const tab = {
    id: tabId,
    type: 'markdown' as const,
    title: title ?? basenameFromPath(filePath),
    markdownFilePath: filePath,
  }

  useAppStore.setState((s) => ({
    tabs: [...s.tabs, tab],
    activeTabId: tabId,
  }))
  useTabGroupStore.getState().addTabToActiveGroupIfAny(tabId)
  return tabId
}

export async function openMarkdownFile(filePath: string): Promise<string | null> {
  if (!isMarkdownFilePath(filePath)) return null

  const existingId = findMarkdownTabByPath(filePath)
  if (existingId) {
    useAppStore.getState().setActiveTab(existingId)
    return existingId
  }

  const result = await getElectronAPI().markdown.readFile(filePath)
  if (!result.ok) {
    if (result.error === 'FILE_TOO_LARGE') {
      toast.error(i18n.t('markdownEditor.fileTooLarge'))
    } else {
      toast.error(i18n.t('markdownEditor.openFailed'))
    }
    return null
  }

  return openMarkdownTabWithContent(result.path, result.content)
}

export async function openMarkdownFileFromDialog(): Promise<string | null> {
  const result = await getElectronAPI().markdown.openFile()
  if (!result.ok) {
    if ('canceled' in result && result.canceled) return null
    if ('error' in result && result.error === 'FILE_TOO_LARGE') {
      toast.error(i18n.t('markdownEditor.fileTooLarge'))
    } else {
      toast.error(i18n.t('markdownEditor.openFailed'))
    }
    return null
  }
  return openMarkdownTabWithContent(result.path, result.content)
}
