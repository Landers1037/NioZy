import { create } from 'zustand'

type State = {
  /** 拖动透明度滑块时的实时预览值；为 null 时使用已保存设置 */
  previewOpacity: number | null
  setPreviewOpacity: (value: number | null) => void
  /** 背景图更换时递增，用于同扩展名换图时强制终端层重新拉取 URL */
  imageRevision: number
  bumpImageRevision: () => void
}

export const useTerminalBackgroundPreviewStore = create<State>((set) => ({
  previewOpacity: null,
  setPreviewOpacity: (previewOpacity) => set({ previewOpacity }),
  imageRevision: 0,
  bumpImageRevision: () => set((s) => ({ imageRevision: s.imageRevision + 1 })),
}))
