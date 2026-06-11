import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import {
  layoutSidebarSlotVariants,
  layoutTabBarVariants,
  usePanelAnimationEnabled,
} from '@/lib/panel-animations'

interface AnimatedMinimalTabBarProps {
  show: boolean
  children: ReactNode
}

/** 极简布局 Tab 栏显隐（布局模式切换到 minimal 时） */
export function AnimatedMinimalTabBar({ show, children }: AnimatedMinimalTabBarProps) {
  const animate = usePanelAnimationEnabled()

  if (!animate) {
    return show ? children : null
  }

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="minimal-tab-bar"
          className="shrink-0 overflow-hidden"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={layoutTabBarVariants}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

interface AnimatedSidebarSlotProps {
  show: boolean
  children: ReactNode
}

/** 左侧边栏显隐（布局模式切换到 default/focus 时） */
export function AnimatedSidebarSlot({ show, children }: AnimatedSidebarSlotProps) {
  const animate = usePanelAnimationEnabled()

  if (!animate) {
    return show ? children : null
  }

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="sidebar-slot"
          className="h-full shrink-0 overflow-hidden"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={layoutSidebarSlotVariants}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
