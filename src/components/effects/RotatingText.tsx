import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface RotatingTextProps {
  texts: readonly string[]
  className?: string
  rotationInterval?: number
  auto?: boolean
  loop?: boolean
  animateEnabled?: boolean
}

export function RotatingText({
  texts,
  className,
  rotationInterval = 2000,
  auto = true,
  loop = true,
  animateEnabled = true,
}: RotatingTextProps) {
  const reducedMotion = useReducedMotion()
  const shouldAnimate = animateEnabled && !reducedMotion
  const [index, setIndex] = useState(0)
  const [contentWidth, setContentWidth] = useState<number | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!auto || texts.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= texts.length - 1) {
          return loop ? 0 : current
        }
        return current + 1
      })
    }, rotationInterval)
    return () => window.clearInterval(timer)
  }, [auto, loop, rotationInterval, texts.length])

  const currentText = texts[index] ?? ''
  const firstText = texts[0] ?? ''
  const shouldUseChip = (text: string) => text !== firstText
  const getContainerClassName = (text: string) =>
    shouldUseChip(text)
      ? 'rounded-2xl bg-primary px-2.5 py-1 text-primary-foreground shadow-sm leading-none'
      : ''

  useLayoutEffect(() => {
    const node = contentRef.current
    if (!node) return

    const updateWidth = () => setContentWidth(node.offsetWidth)
    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(node)
    return () => resizeObserver.disconnect()
  }, [currentText])

  return (
    <span
      className={cn(
        'inline-flex items-center overflow-hidden transition-[width] duration-300 ease-out',
        className,
      )}
      style={contentWidth === null ? undefined : { width: `${contentWidth}px` }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${index}-${currentText}`}
          ref={contentRef}
          className={cn(
            'inline-flex items-center whitespace-pre leading-none',
            getContainerClassName(currentText),
          )}
          initial={shouldAnimate ? { opacity: 1 } : false}
          animate={{ opacity: 1 }}
          exit={shouldAnimate ? { opacity: 1 } : undefined}
          transition={{ duration: 0 }}
        >
          {Array.from(currentText).map((char, charIndex, chars) => {
            const visualChar = char === ' ' ? '\u00A0' : char
            const delay = (chars.length - 1 - charIndex) * 0.025
            return (
              <span
                key={`${currentText}-${charIndex}-${char}`}
                className="inline-flex items-center overflow-hidden"
              >
                <motion.span
                  className="inline-block"
                  initial={shouldAnimate ? { y: '100%' } : false}
                  animate={{ y: 0 }}
                  exit={shouldAnimate ? { y: '-120%' } : undefined}
                  transition={
                    shouldAnimate
                      ? {
                          type: 'spring',
                          damping: 30,
                          stiffness: 400,
                          delay,
                        }
                      : { duration: 0 }
                  }
                >
                  {visualChar}
                </motion.span>
              </span>
            )
          })}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
