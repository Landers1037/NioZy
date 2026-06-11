import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { sectionPanelVariants, sidebarNavVariants, usePanelAnimationEnabled } from '@/lib/panel-animations'
import type { SidebarNavDirection } from '@/lib/panel-animations'

interface AnimatedPanelSectionProps {
  sectionKey: string
  children: ReactNode
  className?: string
}

/** 设置子页、仓库列表↔详情等区块切换过渡 */
export function AnimatedPanelSection({
  sectionKey,
  children,
  className,
}: AnimatedPanelSectionProps) {
  const animate = usePanelAnimationEnabled()

  if (!animate) {
    return <div className={className}>{children}</div>
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sectionKey}
        className={cn('h-full min-h-0', className)}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={sectionPanelVariants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

interface AnimatedPanelSwapProps {
  activeKey: string | null
  children: (key: string) => ReactNode
  className?: string
}

/** 按 key 切换整块内容（如仓库 list / detail） */
export function AnimatedPanelSwap({ activeKey, children, className }: AnimatedPanelSwapProps) {
  const animate = usePanelAnimationEnabled()

  if (!animate) {
    return (
      <div className={cn('min-h-0 flex-1', className)}>
        {activeKey ? children(activeKey) : null}
      </div>
    )
  }

  return (
    <div className={cn('relative min-h-0 flex-1', className)}>
      <AnimatePresence mode="wait">
        {activeKey ? (
          <motion.div
            key={activeKey}
            className="absolute inset-0 flex min-h-0 flex-col"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sectionPanelVariants}
          >
            {children(activeKey)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

interface AnimatedLoadingSwapProps {
  loading: boolean
  loadingContent: ReactNode
  children: ReactNode
  className?: string
}

/** 加载态 ↔ 内容态切换（如仓库列表初次加载） */
export function AnimatedLoadingSwap({
  loading,
  loadingContent,
  children,
  className,
}: AnimatedLoadingSwapProps) {
  const animate = usePanelAnimationEnabled()

  if (!animate) {
    return <div className={className}>{loading ? loadingContent : children}</div>
  }

  return (
    <div className={cn('relative min-h-0 flex-1', className)}>
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="absolute inset-0"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sectionPanelVariants}
          >
            {loadingContent}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="absolute inset-0 flex min-h-0 flex-col"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sectionPanelVariants}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface AnimatedSidebarViewSwapProps {
  viewKey: string
  direction: SidebarNavDirection
  children: ReactNode
  className?: string
}

/** 侧栏外层 ↔ 分组内 Tab 列表切换 */
export function AnimatedSidebarViewSwap({
  viewKey,
  direction,
  children,
  className,
}: AnimatedSidebarViewSwapProps) {
  const animate = usePanelAnimationEnabled()

  if (!animate) {
    return <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
  }

  return (
    <div className={cn('relative min-h-0 flex-1', className)}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={viewKey}
          custom={direction}
          className="absolute inset-0 flex min-h-0 flex-col"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={sidebarNavVariants}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
