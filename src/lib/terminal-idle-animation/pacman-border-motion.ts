export type BorderDirection = 'right' | 'down' | 'left' | 'up'

export interface BorderPosition {
  x: number
  y: number
  rotationDeg: number
  direction: BorderDirection
}

export function getBorderPerimeter(width: number, height: number, margin: number): number {
  const topLen = Math.max(width - 2 * margin, 0)
  const sideLen = Math.max(height - 2 * margin, 0)
  return 2 * (topLen + sideLen)
}

/** 沿矩形边框顺时针取点（top → right → bottom → left）。 */
export function getClockwiseBorderPosition(
  width: number,
  height: number,
  margin: number,
  distance: number,
): BorderPosition {
  const topLen = Math.max(width - 2 * margin, 0)
  const rightLen = Math.max(height - 2 * margin, 0)
  const bottomLen = topLen
  const leftLen = rightLen
  const total = topLen + rightLen + bottomLen + leftLen

  if (total <= 0) {
    return { x: width / 2, y: height / 2, rotationDeg: 0, direction: 'right' }
  }

  let d = ((distance % total) + total) % total

  if (d <= topLen) {
    return { x: margin + d, y: margin, rotationDeg: 0, direction: 'right' }
  }
  d -= topLen

  if (d <= rightLen) {
    return { x: width - margin, y: margin + d, rotationDeg: 90, direction: 'down' }
  }
  d -= rightLen

  if (d <= bottomLen) {
    return { x: width - margin - d, y: height - margin, rotationDeg: 180, direction: 'left' }
  }
  d -= bottomLen

  return { x: margin, y: height - margin - d, rotationDeg: 270, direction: 'up' }
}
