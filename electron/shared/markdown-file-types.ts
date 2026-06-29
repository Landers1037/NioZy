export type MarkdownReadFileResult =
  | { ok: true; path: string; content: string }
  | { ok: false; error: 'FILE_TOO_LARGE' | 'READ_FAILED' | 'NOT_FOUND' }

export type MarkdownOpenFileResult =
  | { ok: true; path: string; content: string }
  | { ok: false; canceled: true }
  | { ok: false; error: 'FILE_TOO_LARGE' | 'READ_FAILED' }

export type MarkdownSaveFileInput = {
  content: string
  defaultFileName: string
  filePath?: string
}

export type MarkdownSaveFileResult =
  | { ok: true; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: 'WRITE_FAILED' }

export type MarkdownResolveImagePathResult =
  | { ok: true; path: string; url: string }
  | { ok: false; error: 'NOT_FOUND' | 'INVALID_PATH' | 'READ_FAILED' }
