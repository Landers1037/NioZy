import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripHorizontal, X } from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { AppTab } from '@/stores/app-store'
import { TerminalView } from '@/components/terminal/TerminalView'
import { WterminalView } from '@/components/terminal/WterminalView'
import { SshDisconnectedPane } from '@/components/terminal/SshDisconnectedPane'
import { useAppStore } from '@/stores/app-store'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import {
  getActiveSplitIndex,
  getSplitPanes,
  normalizeTerminalSplitLayout,
  type TerminalSplitLayout,
} from '@/lib/terminal-tab-utils'
import {
  closeSplitPane,
  setActiveSplitPane,
  setTerminalSplitLayout,
  swapSplitPanes,
} from '@/lib/terminal-split-actions'
import { cn } from '@/lib/utils'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { setTerminalRenderPaused } from '@/lib/terminal-render-pause'

interface SplitTerminalPanelProps {
  tab: AppTab
  isTabActive: boolean
}

type ResizeLayoutKey = 'xRatio' | 'yRatio' | 'bottomXRatio'

interface PaneRect {
  left: number
  top: number
  width: number
  height: number
}

interface DividerHandle {
  key: string
  layoutKey: ResizeLayoutKey
  orientation: 'vertical' | 'horizontal'
  left: number
  top: number
  width: number
  height: number
}

interface PanelSize {
  width: number
  height: number
}

const DIVIDER_HIT_SIZE = 12
const DIVIDER_LINE_SIZE = 3
const MIN_PANE_SIZE = 120

function clampRatioByPixels(
  ratio: number,
  totalSize: number,
): number {
  if (!(totalSize > 0)) return 0.5
  const minRatio = Math.min(0.45, MIN_PANE_SIZE / totalSize)
  const maxRatio = 1 - minRatio
  return Math.min(maxRatio, Math.max(minRatio, ratio))
}

function computePaneRects(
  paneCount: number,
  size: PanelSize,
  layout: TerminalSplitLayout | undefined,
): PaneRect[] {
  const width = Math.max(0, size.width)
  const height = Math.max(0, size.height)
  if (paneCount <= 0 || width === 0 || height === 0) return []
  if (paneCount === 1) return [{ left: 0, top: 0, width, height }]

  const normalized = normalizeTerminalSplitLayout(layout, paneCount)
  if (paneCount === 2) {
    const splitX = Math.round(width * (normalized?.xRatio ?? 0.5))
    return [
      { left: 0, top: 0, width: splitX, height },
      { left: splitX, top: 0, width: width - splitX, height },
    ]
  }
  if (paneCount === 3) {
    const splitY = Math.round(height * (normalized?.yRatio ?? 0.5))
    const bottomSplitX = Math.round(width * (normalized?.bottomXRatio ?? 0.5))
    return [
      { left: 0, top: 0, width, height: splitY },
      { left: 0, top: splitY, width: bottomSplitX, height: height - splitY },
      { left: bottomSplitX, top: splitY, width: width - bottomSplitX, height: height - splitY },
    ]
  }

  const splitX = Math.round(width * (normalized?.xRatio ?? 0.5))
  const splitY = Math.round(height * (normalized?.yRatio ?? 0.5))
  return [
    { left: 0, top: 0, width: splitX, height: splitY },
    { left: splitX, top: 0, width: width - splitX, height: splitY },
    { left: 0, top: splitY, width: splitX, height: height - splitY },
    { left: splitX, top: splitY, width: width - splitX, height: height - splitY },
  ]
}

function computeDividerHandles(
  paneCount: number,
  size: PanelSize,
  layout: TerminalSplitLayout | undefined,
): DividerHandle[] {
  const width = Math.max(0, size.width)
  const height = Math.max(0, size.height)
  if (paneCount <= 1 || width === 0 || height === 0) return []

  const normalized = normalizeTerminalSplitLayout(layout, paneCount)
  if (paneCount === 2) {
    const splitX = Math.round(width * (normalized?.xRatio ?? 0.5))
    return [
      {
        key: 'xRatio',
        layoutKey: 'xRatio',
        orientation: 'vertical',
        left: splitX - DIVIDER_HIT_SIZE / 2,
        top: 0,
        width: DIVIDER_HIT_SIZE,
        height,
      },
    ]
  }
  if (paneCount === 3) {
    const splitY = Math.round(height * (normalized?.yRatio ?? 0.5))
    const bottomSplitX = Math.round(width * (normalized?.bottomXRatio ?? 0.5))
    return [
      {
        key: 'yRatio',
        layoutKey: 'yRatio',
        orientation: 'horizontal',
        left: 0,
        top: splitY - DIVIDER_HIT_SIZE / 2,
        width,
        height: DIVIDER_HIT_SIZE,
      },
      {
        key: 'bottomXRatio',
        layoutKey: 'bottomXRatio',
        orientation: 'vertical',
        left: bottomSplitX - DIVIDER_HIT_SIZE / 2,
        top: splitY,
        width: DIVIDER_HIT_SIZE,
        height: Math.max(0, height - splitY),
      },
    ]
  }

  const splitX = Math.round(width * (normalized?.xRatio ?? 0.5))
  const splitY = Math.round(height * (normalized?.yRatio ?? 0.5))
  return [
    {
      key: 'xRatio',
      layoutKey: 'xRatio',
      orientation: 'vertical',
      left: splitX - DIVIDER_HIT_SIZE / 2,
      top: 0,
      width: DIVIDER_HIT_SIZE,
      height,
    },
    {
      key: 'yRatio',
      layoutKey: 'yRatio',
      orientation: 'horizontal',
      left: 0,
      top: splitY - DIVIDER_HIT_SIZE / 2,
      width,
      height: DIVIDER_HIT_SIZE,
    },
  ]
}

function findPaneIndexAtPoint(
  pointX: number,
  pointY: number,
  paneRects: PaneRect[],
): number {
  return paneRects.findIndex((rect) => {
    const withinX = pointX >= rect.left && pointX <= rect.left + rect.width
    const withinY = pointY >= rect.top && pointY <= rect.top + rect.height
    return withinX && withinY
  })
}

export function SplitTerminalPanel({ tab, isTabActive }: SplitTerminalPanelProps) {
  const { t } = useTranslation()
  const terminalEmulator = useAppStore(
    (s) => s.settings?.experimental?.terminalEmulator ?? 'xterm',
  )
  const useWterm = terminalEmulator === 'wterm'
  const superPowerSaving = useAppStore((s) => s.settings?.performance.superPowerSaving === true)
  const sshDisconnectedTerminalIds = useAppStore((s) => s.sshDisconnectedTerminalIds)
  const accentColor = useAppStore((s) => s.settings?.accentColor ?? '#5C6B7A')
  const TerminalComponent = useWterm ? WterminalView : TerminalView
  const panes = getSplitPanes(tab)
  const activeIndex = getActiveSplitIndex(tab)
  const paneTerminalIdsKey = panes.map((p) => p.terminalId).join('\0')
  const paneTabs = useMemo(
    () => panes.map((pane) => ({ ...tab, terminalId: pane.terminalId })),
    [tab, paneTerminalIdsKey],
  )
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cleanupInteractionRef = useRef<(() => void) | null>(null)
  const dropTargetIndexRef = useRef<number | null>(null)
  const [panelSize, setPanelSize] = useState<PanelSize>({ width: 0, height: 0 })
  const [hoveredDividerKey, setHoveredDividerKey] = useState<string | null>(null)
  const [draggedPaneIndex, setDraggedPaneIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const splitLayout = useMemo(
    () => normalizeTerminalSplitLayout(tab.splitLayout, panes.length),
    [tab.splitLayout, panes.length],
  )
  const paneRects = useMemo(
    () => computePaneRects(panes.length, panelSize, splitLayout),
    [panes.length, panelSize, splitLayout],
  )
  const dividerHandles = useMemo(
    () => computeDividerHandles(panes.length, panelSize, splitLayout),
    [panes.length, panelSize, splitLayout],
  )

  dropTargetIndexRef.current = dropTargetIndex

  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setPanelSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    setPanelSize({
      width: element.clientWidth,
      height: element.clientHeight,
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      cleanupInteractionRef.current?.()
      cleanupInteractionRef.current = null
    }
  }, [])

  if (panes.length === 0) return null

  function clearInteractionEffects(): void {
    setTerminalRenderPaused(false)
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
  }

  function beginPointerInteraction(
    pointerId: number,
    cursor: string,
    onMove: (event: PointerEvent) => void,
    onEnd: (event: PointerEvent) => void,
  ): void {
    cleanupInteractionRef.current?.()
    setTerminalRenderPaused(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = cursor ?? ''

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      onMove(event)
    }
    const handleEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
      cleanupInteractionRef.current = null
      clearInteractionEffects()
      onEnd(event)
    }

    cleanupInteractionRef.current = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
      clearInteractionEffects()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
  }

  function startResizeDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    layoutKey: ResizeLayoutKey,
    orientation: DividerHandle['orientation'],
  ): void {
    if (panes.length <= 1) return
    event.preventDefault()
    event.stopPropagation()
    touchTabActivity(tab.id)

    const startLayout = splitLayout ?? normalizeTerminalSplitLayout(undefined, panes.length)
    if (!startLayout) return

    const startX = event.clientX
    const startY = event.clientY
    const width = Math.max(panelSize.width, 1)
    const height = Math.max(panelSize.height, 1)
    const startRatio =
      layoutKey === 'xRatio'
        ? startLayout.xRatio ?? 0.5
        : layoutKey === 'yRatio'
          ? startLayout.yRatio ?? 0.5
          : startLayout.bottomXRatio ?? 0.5

    setHoveredDividerKey(layoutKey)
    beginPointerInteraction(
      event.pointerId,
      orientation === 'vertical' ? 'col-resize' : 'row-resize',
      (moveEvent) => {
        const delta =
          layoutKey === 'yRatio' ? moveEvent.clientY - startY : moveEvent.clientX - startX
        const totalSize = layoutKey === 'yRatio' ? height : width
        const nextRatio = clampRatioByPixels(startRatio + delta / totalSize, totalSize)
        const nextLayout: TerminalSplitLayout = {
          ...(startLayout.xRatio !== undefined ? { xRatio: startLayout.xRatio } : {}),
          ...(startLayout.yRatio !== undefined ? { yRatio: startLayout.yRatio } : {}),
          ...(startLayout.bottomXRatio !== undefined
            ? { bottomXRatio: startLayout.bottomXRatio }
            : {}),
          [layoutKey]: nextRatio,
        }
        setTerminalSplitLayout(tab.id, nextLayout)
      },
      () => {
        setHoveredDividerKey(null)
      },
    )
  }

  function startPaneSwapDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    sourceIndex: number,
  ): void {
    if (panes.length <= 1) return
    event.preventDefault()
    event.stopPropagation()
    touchTabActivity(tab.id)
    setActiveSplitPane(tab.id, sourceIndex)
    setDraggedPaneIndex(sourceIndex)
    setDropTargetIndex(sourceIndex)

    beginPointerInteraction(
      event.pointerId,
      'grabbing',
      (moveEvent) => {
        const root = rootRef.current
        if (!root) return
        const bounds = root.getBoundingClientRect()
        const localX = moveEvent.clientX - bounds.left
        const localY = moveEvent.clientY - bounds.top
        const targetIndex = findPaneIndexAtPoint(localX, localY, paneRects)
        setDropTargetIndex(targetIndex >= 0 ? targetIndex : null)
      },
      () => {
        const finalTargetIndex = dropTargetIndexRef.current
        if (
          sourceIndex >= 0 &&
          finalTargetIndex != null &&
          finalTargetIndex >= 0 &&
          finalTargetIndex !== sourceIndex
        ) {
          swapSplitPanes(tab.id, sourceIndex, finalTargetIndex)
        }
        setDraggedPaneIndex(null)
        setDropTargetIndex(null)
      },
    )
  }

  return (
    <div ref={rootRef} className="absolute inset-0 min-w-0 min-h-0 overflow-hidden">
      {panes.map((pane, index) => {
        const rect = paneRects[index]
        if (!rect) return null

        const isPaneActive = index === activeIndex
        const showClose = panes.length > 1 && index > 0
        const paneDisconnected = !!sshDisconnectedTerminalIds[pane.terminalId]
        const showDisconnectedPane = isSshTerminalTab(tab) && paneDisconnected
        const isSwapSource = draggedPaneIndex === index
        const isSwapTarget = dropTargetIndex === index && draggedPaneIndex !== null

        return (
          <div
            key={pane.terminalId}
            className={cn(
              'group/pane absolute min-h-0 min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/20 transition-[box-shadow,border-color,opacity]',
              isSwapSource && 'opacity-75',
            )}
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              borderColor: isSwapTarget ? accentColor : undefined,
              boxShadow: isSwapTarget ? `inset 0 0 0 2px ${accentColor}` : undefined,
            }}
            onPointerDown={() => {
              touchTabActivity(tab.id)
              if (!isPaneActive) setActiveSplitPane(tab.id, index)
            }}
          >
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
              <button
                type="button"
                className="flex h-3.5 w-14 cursor-grab items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/pane:opacity-100 active:cursor-grabbing"
                aria-label={`Move split pane ${index + 1}`}
                onPointerDown={(e) => startPaneSwapDrag(e, index)}
              >
                <GripHorizontal className="size-3.5" />
              </button>
            </div>
            {showClose ? (
              <button
                type="button"
                className="absolute right-3 top-3 z-20 flex size-7 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('tab.closeSplitPaneAria')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => closeSplitPane(tab.id, pane.terminalId)}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            {showDisconnectedPane ? (
              <SshDisconnectedPane tab={paneTabs[index]} terminalId={pane.terminalId} />
            ) : (
              <TerminalComponent
                tab={paneTabs[index]}
                preferDomRenderer={!useWterm && (panes.length > 1 || superPowerSaving)}
                isFocused={isTabActive && isPaneActive}
              />
            )}
          </div>
        )
      })}

      {dividerHandles.map((handle) => {
        const isHovered = hoveredDividerKey === handle.key
        const lineStyle: CSSProperties =
          handle.orientation === 'vertical'
            ? {
                left: Math.max(0, handle.width / 2 - DIVIDER_LINE_SIZE / 2),
                top: 0,
                width: DIVIDER_LINE_SIZE,
                height: '100%',
              }
            : {
                left: 0,
                top: Math.max(0, handle.height / 2 - DIVIDER_LINE_SIZE / 2),
                width: '100%',
                height: DIVIDER_LINE_SIZE,
              }

        return (
          <div
            key={handle.key}
            className={cn(
              'absolute z-30 touch-none',
              handle.orientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize',
            )}
            style={{
              left: handle.left,
              top: handle.top,
              width: handle.width,
              height: handle.height,
            }}
            onPointerEnter={() => setHoveredDividerKey(handle.key)}
            onPointerLeave={() => setHoveredDividerKey((prev) => (prev === handle.key ? null : prev))}
            onPointerDown={(event) => startResizeDrag(event, handle.layoutKey, handle.orientation)}
          >
            <div
              className="absolute rounded-full transition-colors"
              style={{
                ...lineStyle,
                backgroundColor: isHovered ? accentColor : 'rgb(148 163 184 / 0.55)',
                boxShadow: isHovered ? `0 0 0 1px ${accentColor}` : undefined,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
