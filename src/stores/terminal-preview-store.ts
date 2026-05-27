import { create } from 'zustand'
import type { TerminalPreviewFileKind } from '../../electron/shared/terminal-preview-files'

export interface TerminalFilePreviewState {
  filePath: string
  fileName: string
  kind: TerminalPreviewFileKind
}

interface TerminalPreviewStore {
  filePreview: TerminalFilePreviewState | null
  openFilePreview: (state: TerminalFilePreviewState) => void
  closeFilePreview: () => void
}

export const useTerminalPreviewStore = create<TerminalPreviewStore>((set) => ({
  filePreview: null,
  openFilePreview: (filePreview) => set({ filePreview }),
  closeFilePreview: () => set({ filePreview: null }),
}))
