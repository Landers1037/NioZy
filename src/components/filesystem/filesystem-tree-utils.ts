import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import { isScpLocalRoots } from '@/lib/scp-local-path'

export interface TreeNode {
  entry: ScpFileEntry
  children: TreeNode[]
  expanded: boolean
  loading: boolean
  loaded: boolean
}

export function entryKey(entry: ScpFileEntry): string {
  return entry.path
}

const HIDDEN_FILESYSTEM_ENTRY_NAMES = new Set(['$recycle.bin'])

export function isHiddenFilesystemEntry(entry: ScpFileEntry): boolean {
  return HIDDEN_FILESYSTEM_ENTRY_NAMES.has(entry.name.toLowerCase())
}

export function filterFilesystemEntries(entries: ScpFileEntry[]): ScpFileEntry[] {
  return entries.filter((entry) => !isHiddenFilesystemEntry(entry))
}

export function entriesToNodes(entries: ScpFileEntry[]): TreeNode[] {
  return filterFilesystemEntries(entries).map((entry) => ({
    entry,
    children: [],
    expanded: false,
    loading: false,
    loaded: false,
  }))
}

export function updateNode(
  nodes: TreeNode[],
  path: string,
  updater: (node: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((n) => {
    if (n.entry.path === path) return updater(n)
    if (n.children.length > 0) {
      return { ...n, children: updateNode(n.children, path, updater) }
    }
    return n
  })
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.entry.path === path) return n
    const found = findNode(n.children, path)
    if (found) return found
  }
  return undefined
}

/** Windows 绝对路径 → 从盘符到目标的逐级路径链 */
export function getPathChain(targetPath: string): string[] {
  if (isScpLocalRoots(targetPath)) return []

  const normalized = targetPath.replace(/\//g, '\\').replace(/\\+$/, '') || targetPath
  const parts: string[] = []

  if (/^[A-Za-z]:/.test(normalized)) {
    const driveRoot = `${normalized[0].toUpperCase()}:\\`
    parts.push(driveRoot)
    const rest = normalized.slice(2).replace(/^\\+/, '')
    if (!rest) return parts

    let current = driveRoot
    for (const segment of rest.split('\\').filter(Boolean)) {
      current = `${current.replace(/\\+$/, '')}\\${segment}`
      parts.push(current)
    }
    return parts
  }

  if (normalized.startsWith('/')) {
    parts.push('/')
    let current = ''
    for (const segment of normalized.split('/').filter(Boolean)) {
      current = current ? `${current}/${segment}` : `/${segment}`
      parts.push(current)
    }
  }

  return parts
}

export function formatFileSize(bytes: number | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
