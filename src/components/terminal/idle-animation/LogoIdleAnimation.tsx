import { useEffect, useRef, useState } from 'react'
import logoUrl from '@/logo.png'
import { RandomBezierMotion } from '@/lib/terminal-idle-animation/random-motion'
import './terminal-idle-animation.css'

const LOGO_HALF_PX = 26

interface LogoIdleAnimationProps {
  width: number
  height: number
}

export function LogoIdleAnimation({ width, height }: LogoIdleAnimationProps) {
  const motionRef = useRef(new RandomBezierMotion())
  const startMsRef = useRef(performance.now())
  const [position, setPosition] = useState(() => ({
    x: width / 2,
    y: height / 2,
  }))

  useEffect(() => {
    motionRef.current = new RandomBezierMotion()
    startMsRef.current = performance.now()
    let raf = 0

    const tick = () => {
      const elapsedSec = (performance.now() - startMsRef.current) / 1000
      const next = motionRef.current.getPosition(elapsedSec, width, height, LOGO_HALF_PX)
      setPosition(next)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return (
    <div className="logo-idle">
      <img
        src={logoUrl}
        alt=""
        className="logo-idle__logo"
        draggable={false}
        style={{ left: position.x, top: position.y }}
      />
    </div>
  )
}
