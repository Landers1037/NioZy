import type { Terminal } from '@xterm/xterm'
import type { ITheme } from '@xterm/xterm'

type Point = {
  x: number
  y: number
}

export const BLACK_HOLE_EFFECT_RADIUS_PX = 200
export const BLACK_HOLE_CANVAS_SIZE_PX = BLACK_HOLE_EFFECT_RADIUS_PX * 2
const BLACK_HOLE_CORE_RADIUS_PX = 76

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0]! + normalized[0]!, 16)
    const g = Number.parseInt(normalized[1]! + normalized[1]!, 16)
    const b = Number.parseInt(normalized[2]! + normalized[2]!, 16)
    return [r / 255, g / 255, b / 255]
  }
  if (normalized.length >= 6) {
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return [r / 255, g / 255, b / 255]
  }
  return [0, 0, 0]
}

function xtermColorToRgb(value: number | undefined, fallback: [number, number, number]): [number, number, number] {
  if (value === undefined) return fallback
  return [
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  ]
}

function resolveThemeColors(theme: ITheme | undefined): {
  bg: [number, number, number]
  fg: [number, number, number]
} {
  const bg: [number, number, number] = theme?.background
    ? parseHexColor(theme.background.startsWith('#') ? theme.background : `#${theme.background}`)
    : [0.05, 0.05, 0.05]
  const fg: [number, number, number] = theme?.foreground
    ? parseHexColor(theme.foreground.startsWith('#') ? theme.foreground : `#${theme.foreground}`)
    : [0.85, 0.85, 0.85]
  return { bg, fg }
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

/** 从 xterm WebGL canvas 或 buffer 绘制到 2D 纹理源 */
export function findXtermRenderCanvas(term: Terminal): HTMLCanvasElement | null {
  const screen = term.element?.querySelector('.xterm-screen')
  if (!screen) return null
  const canvases = screen.querySelectorAll('canvas')
  let best: HTMLCanvasElement | null = null
  let bestArea = 0
  for (const canvas of canvases) {
    const area = canvas.width * canvas.height
    if (area > bestArea) {
      bestArea = area
      best = canvas
    }
  }
  return best
}

export function renderXtermBufferToCanvas(term: Terminal, target: HTMLCanvasElement): boolean {
  const screen = term.element?.querySelector('.xterm-screen') as HTMLElement | null
  if (!screen) return false

  const rect = screen.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  if (target.width !== width) target.width = width
  if (target.height !== height) target.height = height

  const ctx = target.getContext('2d')
  if (!ctx) return false

  const theme = term.options.theme
  const { bg, fg } = resolveThemeColors(theme)
  ctx.fillStyle = `rgb(${Math.round(bg[0]! * 255)}, ${Math.round(bg[1]! * 255)}, ${Math.round(bg[2]! * 255)})`
  ctx.fillRect(0, 0, width, height)

  const fontSize = term.options.fontSize ?? 13
  const fontFamily = term.options.fontFamily ?? 'monospace'
  const lineHeight = fontSize * (term.options.lineHeight ?? 1)
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'top'

  const buf = term.buffer.active
  const { cols, rows } = term
  const cellW = width / Math.max(cols, 1)
  const cellH = height / Math.max(rows, 1)

  for (let row = 0; row < rows; row++) {
    const line = buf.getLine(row)
    if (!line) continue
    for (let col = 0; col < cols; col++) {
      const cell = line.getCell(col)
      if (!cell) continue
      const chars = cell.getChars()
      if (!chars || chars === ' ') continue
      const rgb = xtermColorToRgb(cell.getFgColor(), fg)
      ctx.fillStyle = `rgb(${Math.round(rgb[0]! * 255)}, ${Math.round(rgb[1]! * 255)}, ${Math.round(rgb[2]! * 255)})`
      ctx.fillText(chars, col * cellW, row * cellH + (cellH - lineHeight) / 2)
    }
  }

  return true
}

export function syncTerminalCaptureCanvas(
  term: Terminal,
  captureCanvas: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const webglCanvas = findXtermRenderCanvas(term)
  if (webglCanvas && webglCanvas.width > 0 && webglCanvas.height > 0) {
    const ctx = captureCanvas.getContext('2d')
    if (!ctx) return null
    if (captureCanvas.width !== webglCanvas.width) captureCanvas.width = webglCanvas.width
    if (captureCanvas.height !== webglCanvas.height) captureCanvas.height = webglCanvas.height
    ctx.drawImage(webglCanvas, 0, 0)
    return captureCanvas
  }
  return renderXtermBufferToCanvas(term, captureCanvas) ? captureCanvas : null
}

type CurveSegment = {
  p0: Point
  p1: Point
  p2: Point
  p3: Point
  startSec: number
  durationSec: number
}

/** 黑洞从随机位置出现，然后沿随机生成的贝塞尔曲线缓慢连续移动。 */
export class BlackHoleMotion {
  private segments: CurveSegment[] = []
  private initialized = false

  getPosition(elapsedSec: number, width: number, height: number, coreRadiusPx: number): Point {
    this.ensurePath(elapsedSec, width, height, coreRadiusPx)
    const segment = this.findSegment(elapsedSec)
    const rawT = clamp((elapsedSec - segment.startSec) / segment.durationSec, 0, 1)
    return cubicBezier(segment.p0, segment.p1, segment.p2, segment.p3, smoothstep(rawT))
  }

  private ensurePath(nowSec: number, width: number, height: number, coreRadiusPx: number): void {
    if (!this.initialized) {
      const start = this.randomPoint(width, height, coreRadiusPx)
      this.segments = [this.createSegment(start, nowSec, width, height, coreRadiusPx)]
      this.initialized = true
    }

    while (this.lastSegmentEndSec() < nowSec + 20) {
      const prev = this.segments[this.segments.length - 1]!
      this.segments.push(
        this.createSegment(prev.p3, prev.startSec + prev.durationSec, width, height, coreRadiusPx),
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
    coreRadiusPx: number,
  ): CurveSegment {
    const end = this.randomPoint(width, height, coreRadiusPx)
    const controlDistance = Math.hypot(end.x - start.x, end.y - start.y) * (0.35 + Math.random() * 0.5)
    const p1 = this.clampPoint(
      {
        x: start.x + Math.cos(Math.random() * Math.PI * 2) * controlDistance,
        y: start.y + Math.sin(Math.random() * Math.PI * 2) * controlDistance,
      },
      width,
      height,
      coreRadiusPx,
    )
    const p2 = this.clampPoint(
      {
        x: end.x + Math.cos(Math.random() * Math.PI * 2) * controlDistance,
        y: end.y + Math.sin(Math.random() * Math.PI * 2) * controlDistance,
      },
      width,
      height,
      coreRadiusPx,
    )

    return {
      p0: start,
      p1,
      p2,
      p3: end,
      startSec,
      durationSec: lerp(14, 28, Math.random()),
    }
  }

  private randomPoint(width: number, height: number, coreRadiusPx: number): Point {
    const margin = coreRadiusPx * 3.2
    return {
      x: lerp(margin, Math.max(margin, width - margin), Math.random()),
      y: lerp(margin, Math.max(margin, height - margin), Math.random()),
    }
  }

  private clampPoint(point: Point, width: number, height: number, coreRadiusPx: number): Point {
    const margin = coreRadiusPx * 2.7
    return {
      x: clamp(point.x, margin, Math.max(margin, width - margin)),
      y: clamp(point.y, margin, Math.max(margin, height - margin)),
    }
  }
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_terminal;
uniform float u_coreRadiusPx;
uniform vec2 u_resolution;
uniform vec2 u_sourceResolution;
uniform vec2 u_viewportOriginPx;
uniform float u_time;

void main() {
  vec2 uv = v_uv;
  vec2 px = vec2(uv.x * u_resolution.x, uv.y * u_resolution.y);
  vec2 terminalPx = u_viewportOriginPx + px;
  vec2 center = u_resolution * 0.5;
  vec2 dPx = px - center;
  float distPx = length(dPx);
  float r = distPx / u_coreRadiusPx;
  vec2 dirPx = dPx / max(distPx, 0.001);

  vec2 baseUv = clamp(terminalPx / u_sourceResolution, 0.0, 1.0);
  vec3 base = texture(u_terminal, baseUv).rgb;
  float lensMask = 1.0 - smoothstep(u_coreRadiusPx * 0.9, ${BLACK_HOLE_EFFECT_RADIUS_PX.toFixed(1)}, distPx);

  // 玻璃折射：扭曲强度从黑洞中心向边缘逐渐减弱，外缘完全回到原图。
  float bendStrength = pow(lensMask, 1.7);
  float sourceRadiusPx =
    distPx +
    u_coreRadiusPx * bendStrength * (1.55 / max(r, 0.22)) +
    u_coreRadiusPx * exp(-pow((r - 1.28) / 0.58, 2.0)) * 0.42;
  float sourceAngle =
    atan(dPx.y, dPx.x) +
    bendStrength * 0.34 +
    sin(r * 4.2 + u_time * 0.22) * bendStrength * 0.045;
  vec2 samplePx = u_viewportOriginPx + center + vec2(cos(sourceAngle), sin(sourceAngle)) * sourceRadiusPx;

  // 切向拉伸让经过的文字沿边缘弯曲，而不是只做简单缩放。
  vec2 tangentPx = vec2(-sin(sourceAngle), cos(sourceAngle));
  samplePx += tangentPx * sin(r * 7.0 + u_time * 0.18) * bendStrength * u_coreRadiusPx * 0.11;
  vec2 sampleUv = clamp(samplePx / u_sourceResolution, 0.0, 1.0);

  // 轻微色散，仅用于强化玻璃边缘，不改变为发光光晕。
  vec2 chroma = dirPx * bendStrength * 2.2 / u_resolution;
  vec3 refracted;
  refracted.r = texture(u_terminal, clamp(sampleUv + chroma, 0.0, 1.0)).r;
  refracted.g = texture(u_terminal, sampleUv).g;
  refracted.b = texture(u_terminal, clamp(sampleUv - chroma, 0.0, 1.0)).b;
  vec3 col = mix(base, refracted, lensMask);

  // 只有中心事件视界是黑色，其余区域都保持“透明玻璃”。
  float core = 1.0 - smoothstep(0.94, 1.02, r);
  col = mix(col, vec3(0.0), core);

  // 细白边只定义黑洞核心轮廓，不制造黑色外圈。
  float rim = exp(-pow((r - 1.03) / 0.032, 2.0)) * (1.0 - core);
  col = mix(col, vec3(1.0), clamp(rim, 0.0, 0.92));

  // 非发光的玻璃高光，帮助读出透镜形状。
  float glassSpec =
    exp(-pow((r - 1.7) / 0.5, 2.0)) *
    max(dot(dirPx, normalize(vec2(-0.7, 0.55))), 0.0) *
    lensMask;
  col += vec3(1.0) * glassSpec * 0.1;

  outColor = vec4(col, 1.0);
}
`

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown'
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown'
    gl.deleteProgram(program)
    throw new Error(`Program link failed: ${log}`)
  }
  return program
}

export interface BlackHoleFrameState {
  left: number
  top: number
  size: number
}

export class BlackHoleRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private texture: WebGLTexture
  private captureCanvas: HTMLCanvasElement
  private uCoreRadiusPx: WebGLUniformLocation
  private uResolution: WebGLUniformLocation
  private uSourceResolution: WebGLUniformLocation
  private uViewportOriginPx: WebGLUniformLocation
  private uTime: WebGLUniformLocation
  private uTerminal: WebGLUniformLocation
  private motion = new BlackHoleMotion()
  private startMs = performance.now()

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })
    if (!gl) throw new Error('WebGL2 not available')
    this.gl = gl
    this.program = createProgram(gl)
    this.captureCanvas = document.createElement('canvas')

    const posLoc = gl.getAttribLocation(this.program, 'a_pos')
    this.uCoreRadiusPx = gl.getUniformLocation(this.program, 'u_coreRadiusPx')!
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!
    this.uSourceResolution = gl.getUniformLocation(this.program, 'u_sourceResolution')!
    this.uViewportOriginPx = gl.getUniformLocation(this.program, 'u_viewportOriginPx')!
    this.uTime = gl.getUniformLocation(this.program, 'u_time')!
    this.uTerminal = gl.getUniformLocation(this.program, 'u_terminal')!

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    this.texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
    this.gl.clearColor(0, 0, 0, 0)
  }

  computeFrameState(elapsedSec: number, width: number, height: number): BlackHoleFrameState {
    const size = BLACK_HOLE_CANVAS_SIZE_PX
    const { x, y } = this.motion.getPosition(elapsedSec, width, height, BLACK_HOLE_EFFECT_RADIUS_PX)
    return {
      left: clamp(x - size / 2, 0, Math.max(0, width - size)),
      top: clamp(y - size / 2, 0, Math.max(0, height - size)),
      size,
    }
  }

  getFrame(width: number, height: number): BlackHoleFrameState {
    return this.computeFrameState((performance.now() - this.startMs) / 1000, width, height)
  }

  render(
    term: Terminal,
    frame: BlackHoleFrameState,
    sourceCssSize: { width: number; height: number },
  ): boolean {
    const source = syncTerminalCaptureCanvas(term, this.captureCanvas)
    if (!source) return false

    const { gl, program, texture } = this
    const scaleX = source.width / Math.max(1, sourceCssSize.width)
    const scaleY = source.height / Math.max(1, sourceCssSize.height)
    const width = Math.max(1, Math.round(frame.size * scaleX))
    const height = Math.max(1, Math.round(frame.size * scaleY))
    this.resize(width, height)
    if (width <= 0 || height <= 0) return false

    const elapsedSec = (performance.now() - this.startMs) / 1000

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)

    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.uTerminal, 0)
    gl.bindVertexArray(this.vao)
    gl.uniform1f(this.uCoreRadiusPx, BLACK_HOLE_CORE_RADIUS_PX * Math.max(scaleX, scaleY))
    gl.uniform2f(this.uResolution, width, height)
    gl.uniform2f(this.uSourceResolution, source.width, source.height)
    gl.uniform2f(this.uViewportOriginPx, frame.left * scaleX, frame.top * scaleY)
    gl.uniform1f(this.uTime, elapsedSec)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return true
  }

  dispose(): void {
    const { gl } = this
    gl.deleteTexture(this.texture)
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
  }
}
