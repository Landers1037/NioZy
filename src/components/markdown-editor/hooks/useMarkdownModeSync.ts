import { useCallback } from 'react'
import { useMarkdownEditorStore } from '@/stores/markdown-editor-store'

export function useMarkdownModeSync(tabId: string) {
  const mode = useMarkdownEditorStore((s) => s.sessions[tabId]?.mode ?? 'wysiwyg')
  const setMode = useMarkdownEditorStore((s) => s.setMode)

  const toggleMode = useCallback(() => {
    setMode(tabId, mode === 'wysiwyg' ? 'source' : 'wysiwyg')
  }, [mode, setMode, tabId])

  const setWysiwyg = useCallback(
    (enabled: boolean) => {
      setMode(tabId, enabled ? 'wysiwyg' : 'source')
    },
    [setMode, tabId],
  )

  return {
    mode,
    isWysiwyg: mode === 'wysiwyg',
    toggleMode,
    setWysiwyg,
  }
}
