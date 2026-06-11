import { GitBranch, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitGraphRow } from '../../../electron/shared/repo-types'
import { commitSubject, GRAPH_LIST_HEADER_HEIGHT, GRAPH_ROW_HEIGHT } from '@/lib/git-graph-layout'

interface GitCommitListProps {
  rows: GitGraphRow[]
  selectedSha: string | null
  graphGutterWidth: number
  onSelectCommit: (sha: string) => void
}

function RefBadges({ row }: { row: GitGraphRow }) {
  const heads = row.heads ?? []
  const remotes = row.remotes ?? []
  const tags = row.tags ?? []

  if (heads.length === 0 && remotes.length === 0 && tags.length === 0) {
    return <span className="text-muted-foreground/40">—</span>
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {heads.map((head) => (
        <span
          key={head.id}
          className={cn(
            'inline-flex max-w-full items-center gap-0.5 truncate rounded px-1.5 py-0.5 text-[10px] font-medium',
            head.isCurrentHead
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
          title={head.name}
        >
          <GitBranch className="size-2.5 shrink-0" />
          <span className="truncate">{head.name}</span>
        </span>
      ))}
      {remotes.map((remote) => (
        <span
          key={remote.id}
          className="inline-flex max-w-full items-center gap-0.5 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          title={remote.name}
        >
          <GitBranch className="size-2.5 shrink-0 opacity-60" />
          <span className="truncate">{remote.name}</span>
        </span>
      ))}
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex max-w-full items-center gap-0.5 truncate rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"
          title={tag.name}
        >
          <Tag className="size-2.5 shrink-0" />
          <span className="truncate">{tag.name}</span>
        </span>
      ))}
    </div>
  )
}

export function GitCommitList({
  rows,
  selectedSha,
  graphGutterWidth,
  onSelectCommit,
}: GitCommitListProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <div
        className="sticky top-0 z-20 grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)_minmax(88px,120px)_minmax(120px,160px)_64px] items-center gap-2 border-b border-border bg-muted/80 pl-3 pr-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm"
        style={{ height: GRAPH_LIST_HEADER_HEIGHT, paddingLeft: graphGutterWidth + 12 }}
      >
        <span>分支 / 标签</span>
        <span>提交说明</span>
        <span>作者</span>
        <span>日期</span>
        <span>SHA</span>
      </div>
      <ul className="relative z-10 divide-y divide-border/60">
        {rows.map((row) => {
          const selected = selectedSha === row.sha
          const subject = commitSubject(row.message)
          return (
            <li key={row.sha}>
              <button
                type="button"
                onClick={() => onSelectCommit(row.sha)}
                className={cn(
                  'grid w-full grid-cols-[minmax(120px,1fr)_minmax(0,2fr)_minmax(88px,120px)_minmax(120px,160px)_64px] gap-2 py-0 pl-3 pr-3 text-left text-sm transition-colors hover:bg-muted/50',
                  selected && 'bg-primary/10 hover:bg-primary/15',
                )}
                style={{ height: GRAPH_ROW_HEIGHT, paddingLeft: graphGutterWidth + 12 }}
              >
                <div className="min-w-0 self-center">
                  <RefBadges row={row} />
                </div>
                <div className="min-w-0 self-center">
                  <p className="truncate font-medium text-foreground" title={subject}>
                    {subject}
                  </p>
                </div>
                <div className="min-w-0 self-center truncate text-xs text-muted-foreground" title={row.author}>
                  {row.author}
                </div>
                <div className="min-w-0 self-center truncate text-xs tabular-nums text-muted-foreground">
                  {new Date(row.date).toLocaleString()}
                </div>
                <div className="self-center font-mono text-xs text-muted-foreground">
                  {row.sha.slice(0, 7)}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
