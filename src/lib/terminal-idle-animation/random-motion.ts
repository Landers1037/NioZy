type Point = {
  x: number
  y: number
}

type CurveSegment = {
  p0: Point
  p1: Point
  p2: Point
  p3: Point
  startSec: number
  durationSec: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

/** 沿随机贝塞尔曲线在区域内连续移动。 */
export class RandomBezierMotion {
  private segments: CurveSegment[] = []
  private initialized = false

  getPosition(elapsedSec: number, width: number, height: number, marginPx: number): Point {
    this.ensurePath(elapsedSec, width, height, marginPx)
    const segment = this.findSegment(elapsedSec)
    const rawT = clamp((elapsedSec - segment.startSec) / segment.durationSec, 0, 1)
    return cubicBezier(segment.p0, segment.p1, segment.p2, segment.p3, smoothstep(rawT))
  }

  private getBounds(width: number, height: number, marginPx: number) {
    const minX = marginPx
    const maxX = width - marginPx
    const minY = marginPx
    const maxY = height - marginPx
    return {
      minX,
      maxX: Math.max(minX, maxX),
      minY,
      maxY: Math.max(minY, maxY),
      centerX: width / 2,
      centerY: height / 2,
    }
  }

  private ensurePath(nowSec: number, width: number, height: number, marginPx: number): void {
    if (!this.initialized) {
      const start = this.randomPoint(width, height, marginPx)
      this.segments = [this.createSegment(start, nowSec, width, height, marginPx)]
      this.initialized = true
    }

    while (this.lastSegmentEndSec() < nowSec + 20) {
      const prev = this.segments[this.segments.length - 1]!
      this.segments.push(
        this.createSegment(prev.p3, prev.startSec + prev.durationSec, width, height, marginPx),
      )
    }

    this.segments = this.segments.filter(
      (segment) => segment.startSec + segment.durationSec > nowSec - 5,
    )
  }

  private findSegment(nowSec: number): CurveSegment {
    return (
      this.segments.find(
        (segment) => nowSec >= segment.startSec && nowSec <= segment.startSec + segment.durationSec,
      ) ?? this.segments[this.segments.length - 1]!
    )
  }

  private lastSegmentEndSec(): number {
    const last = this.segments[this.segments.length - 1]
    return last ? last.startSec + last.durationSec : 0
  }

  private createSegment(
    start: Point,
    startSec: number,
    width: number,
    height: number,
    marginPx: number,
  ): CurveSegment {
    const end = this.randomPoint(width, height, marginPx)
    const bounds = this.getBounds(width, height, marginPx)
    const spanX = Math.max(bounds.maxX - bounds.minX, 1)
    const spanY = Math.max(bounds.maxY - bounds.minY, 1)
    const controlDistance =
      Math.hypot((end.x - start.x) / spanX, (end.y - start.y) / spanY) *
      Math.hypot(spanX, spanY) *
      (0.35 + Math.random() * 0.5)
    const p1 = this.clampPoint(
      {
        x: start.x + Math.cos(Math.random() * Math.PI * 2) * controlDistance,
        y: start.y + Math.sin(Math.random() * Math.PI * 2) * controlDistance,
      },
      width,
      height,
      marginPx,
    )
    const p2 = this.clampPoint(
      {
        x: end.x + Math.cos(Math.random() * Math.PI * 2) * controlDistance,
        y: end.y + Math.sin(Math.random() * Math.PI * 2) * controlDistance,
      },
      width,
      height,
      marginPx,
    )

    return {
      p0: start,
      p1,
      p2,
      p3: end,
      startSec,
      durationSec: lerp(10, 22, Math.random()),
    }
  }

  private randomPoint(width: number, height: number, marginPx: number): Point {
    const bounds = this.getBounds(width, height, marginPx)
    return {
      x:
        bounds.maxX > bounds.minX
          ? lerp(bounds.minX, bounds.maxX, Math.random())
          : bounds.centerX,
      y:
        bounds.maxY > bounds.minY
          ? lerp(bounds.minY, bounds.maxY, Math.random())
          : bounds.centerY,
    }
  }

  private clampPoint(point: Point, width: number, height: number, marginPx: number): Point {
    const bounds = this.getBounds(width, height, marginPx)
    return {
      x: clamp(point.x, bounds.minX, bounds.maxX),
      y: clamp(point.y, bounds.minY, bounds.maxY),
    }
  }
}
