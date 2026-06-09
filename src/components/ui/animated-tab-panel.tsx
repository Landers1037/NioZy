import { Suspense, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  panelEnterTransition,
  tabPanelVariants,
  usePanelAnimationEnabled,
} from '@/lib/panel-animations'

function TabPanelLoadingFallback() {
  return (
    <motion.div
      className="flex h-full items-center justify-center text-muted-foreground"
      initial={{ opacity: 0, y: '2.5rem' }}
      animate={{ opacity: 1, y: 0 }}
      transition={panelEnterTransition}
    >
      <Loader2 className="size-6 animate-spin" aria-hidden />
    </motion.div>
  )
}

interface AnimatedTabPanelProps {
  active: boolean
  children: ReactNode
  className?: string
}

/** 设置 / 聊天 / 仓库等 Tab 右侧面板的进入与 lazy 加载过渡 */
export function AnimatedTabPanel({ active, children, className }: AnimatedTabPanelProps) {
  const animate = usePanelAnimationEnabled()

  const content = (
    <Suspense fallback={animate ? <TabPanelLoadingFallback /> : null}>{children}</Suspense>
  )

  if (!animate) {
    return (
      <div
        className={cn(
          'absolute inset-0',
          !active && 'pointer-events-none invisible',
          className,
        )}
        {...(!active ? { inert: true } : {})}
      >
        {content}
      </div>
    )
  }

  return (
    <motion.div
      className={cn('absolute inset-0', active ? 'z-10' : 'pointer-events-none', className)}
      initial={false}
      animate={active ? 'visible' : 'hidden'}
      variants={tabPanelVariants}
      aria-hidden={!active}
      {...(!active ? { inert: true } : {})}
    >
      {content}
    </motion.div>
  )
}
