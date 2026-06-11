export type DrawingFileKind = 'excalidraw' | 'drawio'

export type DrawingOpenFileResult =
  | { ok: true; path: string; content: string }
  | { ok: false; canceled: true }
  | { ok: false; error: 'READ_FAILED' }

export type DrawingSaveFileInput = {
  kind: DrawingFileKind
  content: string
  defaultFileName: string
  filePath?: string
}

export type DrawingSaveFileResult =
  | { ok: true; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: 'WRITE_FAILED' }
