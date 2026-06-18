export type DiffLineKind = 'header' | 'hunk' | 'add' | 'del' | 'ctx'

export interface DiffLine {
  text: string
  kind: DiffLineKind
}

export function classifyDiffLine(line: string): DiffLineKind {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
    return 'header'
  }
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return 'ctx'
}

export function parseDiffLines(diff: string): DiffLine[] {
  if (!diff) return []
  return diff.split('\n').map((text) => ({
    text,
    kind: classifyDiffLine(text),
  }))
}

export const DIFF_LINE_HEIGHT_PX = 18

export function diffLineClass(kind: DiffLineKind): string {
  switch (kind) {
    case 'header':
      return 'text-muted-foreground'
    case 'hunk':
      return 'text-primary'
    case 'add':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'del':
      return 'bg-red-500/10 text-red-700 dark:text-red-300'
    default:
      return ''
  }
}
