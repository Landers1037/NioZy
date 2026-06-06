import { cn } from '@/lib/utils'

interface CommitFileDiffViewProps {
  diff: string
  className?: string
}

function diffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
    return 'text-muted-foreground'
  }
  if (line.startsWith('@@')) return 'text-primary'
  if (line.startsWith('+')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (line.startsWith('-')) return 'bg-red-500/10 text-red-700 dark:text-red-300'
  return ''
}

export function CommitFileDiffView({ diff, className }: CommitFileDiffViewProps) {
  if (!diff) {
    return null
  }

  const lines = diff.split('\n')

  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed',
        className,
      )}
    >
      {lines.map((line, index) => (
        <div key={`${index}-${line.slice(0, 8)}`} className={cn('whitespace-pre', diffLineClass(line))}>
          {line || ' '}
        </div>
      ))}
    </pre>
  )
}
