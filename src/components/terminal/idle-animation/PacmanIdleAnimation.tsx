import { useEffect, useRef, useState } from 'react'
import {
  getClockwiseBorderPosition,
  type BorderDirection,
} from '@/lib/terminal-idle-animation/pacman-border-motion'
import './terminal-idle-animation.css'

const PACMAN_SIZE_PX = 28
const BORDER_MARGIN_PX = PACMAN_SIZE_PX / 2 + 2
const BORDER_SPEED_PX_PER_SEC = 95
const GHOST_CHASE_OFFSETS_PX = [42, 78, 114]

interface PacmanIdleAnimationProps {
  width: number
  height: number
}

interface ActorFrame {
  x: number
  y: number
  rotationDeg: number
  direction: BorderDirection
}

export function PacmanIdleAnimation({ width, height }: PacmanIdleAnimationProps) {
  const startMsRef = useRef(performance.now())
  const [frame, setFrame] = useState(() => buildFrame(width, height, 0))

  useEffect(() => {
    startMsRef.current = performance.now()
    let raf = 0

    const tick = () => {
      const elapsedSec = (performance.now() - startMsRef.current) / 1000
      setFrame(buildFrame(width, height, elapsedSec))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return (
    <div className="pacman-idle">
      <div
        className="pacman-idle__actor"
        style={{
          left: frame.pacman.x,
          top: frame.pacman.y,
          transform: `translate(-50%, -50%) rotate(${frame.pacman.rotationDeg}deg)`,
        }}
      >
        <div className="pacman-idle__pacman" />
      </div>

      {frame.ghosts.map((ghost, index) => {
        const pupilOffset = getPupilOffset(ghost.direction)
        return (
          <div
            key={index}
            className="pacman-idle__actor"
            style={{
              left: ghost.x,
              top: ghost.y,
              transform: `translate(-50%, -50%) rotate(${ghost.rotationDeg}deg)`,
            }}
          >
            <div className={`pacman-idle__ghost pacman-idle__ghost--${index}`}>
              <span className="pacman-idle__ghost-eye pacman-idle__ghost-eye--left">
                <span
                  className="pacman-idle__ghost-pupil"
                  style={{ left: pupilOffset.x, top: pupilOffset.y }}
                />
              </span>
              <span className="pacman-idle__ghost-eye pacman-idle__ghost-eye--right">
                <span
                  className="pacman-idle__ghost-pupil"
                  style={{ left: pupilOffset.x, top: pupilOffset.y }}
                />
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function buildFrame(width: number, height: number, elapsedSec: number) {
  const distance = elapsedSec * BORDER_SPEED_PX_PER_SEC
  const pacman = getClockwiseBorderPosition(width, height, BORDER_MARGIN_PX, distance)
  const ghosts = GHOST_CHASE_OFFSETS_PX.map((offset) =>
    getClockwiseBorderPosition(width, height, BORDER_MARGIN_PX, distance - offset),
  )
  return { pacman, ghosts }
}

/** 瞳孔朝运动方向偏移（本地坐标，嘴/朝向为 +X）。 */
function getPupilOffset(direction: BorderDirection): { x: number; y: number } {
  switch (direction) {
    case 'right':
      return { x: 3, y: 1 }
    case 'down':
      return { x: 1, y: 3 }
    case 'left':
      return { x: -1, y: 1 }
    case 'up':
      return { x: 1, y: -1 }
  }
}
