import { create } from 'zustand'

type State = {
  /** 拖动透明度滑块时的实时预览值；为 null 时使用已保存设置 */
  previewOpacity: number | null
  setPreviewOpacity: (value: number | null) => void
}

export const useTerminalBackgroundPreviewStore = create<State>((set) => ({
  previewOpacity: null,
  setPreviewOpacity: (previewOpacity) => set({ previewOpacity }),
}))
