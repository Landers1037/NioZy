import type { MuxLayoutKind, MuxSplitDirection } from '../../electron/shared/mux-terminal-types'
import {
  layoutKindAllowsHorizontalResize,
  layoutKindAllowsVerticalResize,
} from '@/lib/mux-grid-layout'

export function muxSplitDirectionFromKey(
  key: string,
  layoutKind: MuxLayoutKind,
): MuxSplitDirection | null {
  if (key === 'ArrowLeft' && layoutKindAllowsHorizontalResize(layoutKind)) return 'left'
  if (key === 'ArrowRight' && layoutKindAllowsHorizontalResize(layoutKind)) return 'right'
  if (key === 'ArrowUp' && layoutKindAllowsVerticalResize(layoutKind)) return 'up'
  if (key === 'ArrowDown' && layoutKindAllowsVerticalResize(layoutKind)) return 'down'
  return null
}

export function resolveMuxLayoutKind(
  muxLayoutKind: MuxLayoutKind | undefined,
  muxPaneCount: 1 | 2 | 4 | undefined,
): MuxLayoutKind {
  if (muxLayoutKind) return muxLayoutKind
  if (muxPaneCount === 1) return '1'
  if (muxPaneCount === 2) return '2x1'
  return '2x2'
}
