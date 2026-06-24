import { useEffect } from 'react'
import { isMarkdownFilePath } from '../../electron/shared/markdown-file-limits'
import { getDroppedFilePaths, hasExternalFileDrag } from '@/lib/terminal-drop-actions'
import { openMarkdownFile } from '@/lib/markdown-tab-actions'

export function useMarkdownFileDrop(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onDragOver = (event: DragEvent) => {
      if (!hasExternalFileDrag(event.dataTransfer)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer || !hasExternalFileDrag(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()

      const paths = getDroppedFilePaths(event.dataTransfer)
      const mdPaths = paths.filter(isMarkdownFilePath)
      if (mdPaths.length === 0) return

      for (const path of mdPaths) {
        void openMarkdownFile(path)
      }
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [enabled])
}
