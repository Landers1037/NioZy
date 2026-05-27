export function basenameFromPath(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const idx = filePath.lastIndexOf(sep)
  return idx < 0 ? filePath : filePath.slice(idx + 1)
}

/** 取文件或目录的父路径（用于在文件所在目录打开终端） */
export function parentDirectory(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const idx = filePath.lastIndexOf(sep)
  if (idx < 0) return filePath
  if (sep === '\\' && idx === 2 && filePath[1] === ':') return filePath
  if (sep === '/' && idx === 0) return '/'
  return filePath.slice(0, idx)
}
