import type { Transition, Variants } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { useDialogAnimationEnabled } from '@/lib/dialog-animations'

/** 与弹框动画共用「外观 → 动画效果」开关 */
export function usePanelAnimationEnabled(): boolean {
  const enabled = useDialogAnimationEnabled()
  const reducedMotion = useReducedMotion()
  return enabled && !reducedMotion
}

export const panelEnterTransition: Transition = {
  duration: 0.2,
  ease: [0, 0, 0.2, 1],
}

export const panelExitTransition: Transition = {
  duration: 0.1,
  ease: [0.4, 0, 1, 1],
}

/** Tab 面板：自下而上淡入（对齐 dialog-content-in） */
export const tabPanelVariants: Variants = {
  hidden: { opacity: 0, y: '2.5rem', transition: panelExitTransition },
  visible: { opacity: 1, y: 0, transition: panelEnterTransition },
}

/** 设置子页 / 仓库列表↔详情：横向轻移 */
export const sectionPanelVariants: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: panelEnterTransition },
  exit: { opacity: 0, x: -8, transition: panelExitTransition },
}

export type SidebarNavDirection = 'forward' | 'back'

/** 侧栏分组：进入分组自右推入，返回上层自左推入 */
export const sidebarNavVariants: Variants = {
  hidden: (direction: SidebarNavDirection) => ({
    opacity: 0,
    x: direction === 'forward' ? 16 : -16,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: panelEnterTransition,
  },
  exit: (direction: SidebarNavDirection) => ({
    opacity: 0,
    x: direction === 'forward' ? -12 : 12,
    transition: panelExitTransition,
  }),
}

export const loadingFadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

/** 极简布局顶栏 Tab 条 */
export const layoutTabBarVariants: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: panelEnterTransition },
  exit: { opacity: 0, y: -8, transition: panelExitTransition },
}

/** 侧栏布局模式显隐（default/focus ↔ minimal） */
export const layoutSidebarSlotVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: panelEnterTransition },
  exit: { opacity: 0, x: -16, transition: panelExitTransition },
}

export const sidebarWidthTransition: Transition = panelEnterTransition
