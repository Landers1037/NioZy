import { create } from 'zustand'

interface DrawingSessionState {
  excalidrawDirty: boolean
  drawioDirty: boolean
  setExcalidrawDirty: (dirty: boolean) => void
  setDrawioDirty: (dirty: boolean) => void
  resetExcalidraw: () => void
  resetDrawio: () => void
}

export const useDrawingSessionStore = create<DrawingSessionState>((set) => ({
  excalidrawDirty: false,
  drawioDirty: false,
  setExcalidrawDirty: (excalidrawDirty) => set({ excalidrawDirty }),
  setDrawioDirty: (drawioDirty) => set({ drawioDirty }),
  resetExcalidraw: () => set({ excalidrawDirty: false }),
  resetDrawio: () => set({ drawioDirty: false }),
}))
