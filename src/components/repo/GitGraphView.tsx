import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { computeGraphLayout, GRAPH_ROW_HEIGHT } from '@/lib/git-graph-layout'
import type { GitGraphCursor, GitGraphRow } from '../../../electron/shared/repo-types'
import { GitCommitList } from './GitCommitList'
import { GitGraphCanvas, graphCanvasWidth } from './GitGraphCanvas'

interface GitGraphViewProps {
  repoId: string
  selectedSha?: string | null
  onSelectCommit: (sha: string) => void
}

export function GitGraphView({
  repoId,
  selectedSha = null,
  onSelectCommit,
}: GitGraphViewProps) {
  const { t } = useTranslation()
  const accent = useAppStore((s) => s.settings?.accentColor ?? '#5C6B7A')
  const [rows, setRows] = useState<GitGraphRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const cursorRef = useMemo<{ current: GitGraphCursor | undefined }>(() => ({ current: undefined }), [repoId])

  const layout = useMemo(() => computeGraphLayout(rows), [rows])
  const graphGutterWidth = useMemo(() => graphCanvasWidth(layout), [layout])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    cursorRef.current = undefined
    try {
      const result = await getElectronAPI().repo.getGraphCommits(repoId)
      if ('error' in result) {
        setRows([])
        setHasMore(false)
        setLoadError(result.error)
        setLoading(false)
        return
      }
      setRows(result.rows)
      setHasMore(result.hasMore)
      cursorRef.current = result.cursor
      setLoading(false)
    } catch (err: unknown) {
      setRows([])
      setHasMore(false)
      setLoadError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }, [repoId, cursorRef])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const handleShowMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await getElectronAPI().repo.getGraphCommits(repoId, cursorRef.current)
      if ('error' in result) {
        setLoadingMore(false)
        return
      }
      setRows((prev) => [...prev, ...result.rows])
      setHasMore(result.hasMore)
      cursorRef.current = result.cursor
      setLoadingMore(false)
    } catch {
      setLoadingMore(false)
    }
  }, [repoId, hasMore, loadingMore, cursorRef])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t('repo.loadingGraph')}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <AlertTriangle className="size-8 text-destructive" />
        <p className="font-medium text-foreground">{t('repo.graphLoadError')}</p>
        <p className="max-w-md text-xs">{loadError}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('repo.graphEmpty')}
      </div>
    )
  }

  const graphHeight = rows.length * GRAPH_ROW_HEIGHT

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative min-w-max" style={{ minHeight: graphHeight }}>
          <div
            className="pointer-events-none absolute left-0 top-0 z-0 px-1"
            style={{ width: graphGutterWidth, height: graphHeight }}
          >
            <GitGraphCanvas layout={layout} accentColor={accent} className="shrink-0" />
          </div>
          <GitCommitList
            rows={rows}
            selectedSha={selectedSha}
            graphGutterWidth={graphGutterWidth}
            onSelectCommit={onSelectCommit}
          />
        </div>
        {hasMore ? (
          <div className="sticky bottom-0 flex justify-center border-t border-border bg-background/95 py-3 backdrop-blur-sm">
            <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void handleShowMore()}>
              {loadingMore ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t('repo.loadMoreCommits')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
