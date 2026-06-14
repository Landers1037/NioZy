import type { Terminal } from '@xterm/xterm'
import {
  BlackHoleMotion,
  type BlackHoleFrameState,
  renderXtermBufferToCanvas,
} from '@/lib/terminal-idle-animation/black-hole-renderer'
import {
  computeBlackHole2SizeScale,
  getBlackHole2FragmentShader,
} from '@/lib/terminal-idle-animation/black-hole2-shader'

const BLACK_HOLE_CORE_RADIUS_PX = 32   // 黑洞中心半径
const BLACK_HOLE_EFFECT_RADIUS_PX_V2 = 120 // 黑洞效果半径
const HOLE_RADIUS_FRACTION = 0.08

const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
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
    throw new Error(`BlackHole2 shader compile failed: ${log}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, getBlackHole2FragmentShader())
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
    throw new Error(`BlackHole2 program link failed: ${log}`)
  }
  return program
}

export class BlackHole2Renderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private texture: WebGLTexture
  private captureCanvas: HTMLCanvasElement
  private uResolution: WebGLUniformLocation
  private uSourceResolution: WebGLUniformLocation
  private uTime: WebGLUniformLocation
  private uCenter: WebGLUniformLocation
  private uSz: WebGLUniformLocation
  private uEffectRadiusPx: WebGLUniformLocation
  private uTerminal: WebGLUniformLocation
  private motion = new BlackHoleMotion()
  private startMs = performance.now()

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL2 not available')
    this.gl = gl
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this.program = createProgram(gl)
    this.captureCanvas = document.createElement('canvas')

    const posLoc = gl.getAttribLocation(this.program, 'a_pos')
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!
    this.uSourceResolution = gl.getUniformLocation(this.program, 'u_sourceResolution')!
    this.uTime = gl.getUniformLocation(this.program, 'u_time')!
    this.uCenter = gl.getUniformLocation(this.program, 'u_center')!
    this.uSz = gl.getUniformLocation(this.program, 'u_sz')!
    this.uEffectRadiusPx = gl.getUniformLocation(this.program, 'u_effectRadiusPx')!
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
    const margin = BLACK_HOLE_EFFECT_RADIUS_PX_V2 * 1.2
    const { x, y } = this.motion.getPosition(elapsedSec, width, height, margin)
    return { centerX: x, centerY: y }
  }

  getFrame(width: number, height: number): BlackHoleFrameState {
    return this.computeFrameState((performance.now() - this.startMs) / 1000, width, height)
  }

  render(
    term: Terminal,
    frame: BlackHoleFrameState,
    sourceCssSize: { width: number; height: number },
  ): boolean {
    // 优先尝试从 xterm WebGL canvas 直接拷贝（像素精确）
    // 若结果全黑（preserveDrawingBuffer=false 时 composite 后清空），则回退到 buffer 渲染
    const webglCanvas = term.element?.querySelector('.xterm-screen canvas') as HTMLCanvasElement | null
    let source: HTMLCanvasElement = this.captureCanvas
    let gotPixels = false
    if (webglCanvas && webglCanvas.width > 0) {
      const ctx2d = this.captureCanvas.getContext('2d')
      if (ctx2d) {
        if (this.captureCanvas.width !== webglCanvas.width) this.captureCanvas.width = webglCanvas.width
        if (this.captureCanvas.height !== webglCanvas.height) this.captureCanvas.height = webglCanvas.height
        ctx2d.drawImage(webglCanvas, 0, 0)
        // 采样左上角 4px 判断是否非黑
        const px = ctx2d.getImageData(2, 2, 1, 1).data
        if (px[3]! > 0 && (px[0]! + px[1]! + px[2]!) > 0) {
          gotPixels = true
        }
      }
    }
    if (!gotPixels) {
      const ok = renderXtermBufferToCanvas(term, this.captureCanvas)
      if (!ok) return false
    }

    const { gl, program, texture } = this
    const scaleX = source.width / Math.max(1, sourceCssSize.width)
    const scaleY = source.height / Math.max(1, sourceCssSize.height)
    const width = Math.max(1, Math.round(sourceCssSize.width * scaleX))
    const height = Math.max(1, Math.round(sourceCssSize.height * scaleY))
    this.resize(width, height)
    if (width <= 0 || height <= 0) return false

    const elapsedSec = (performance.now() - this.startMs) / 1000
    const centerUvX = frame.centerX / Math.max(sourceCssSize.width, 1)
    const centerUvY = frame.centerY / Math.max(sourceCssSize.height, 1)
    const sz = computeBlackHole2SizeScale(BLACK_HOLE_CORE_RADIUS_PX, sourceCssSize.height)
    const effectRadiusPx = BLACK_HOLE_EFFECT_RADIUS_PX_V2 * Math.max(scaleX, scaleY)

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.uTerminal, 0)
    gl.bindVertexArray(this.vao)
    gl.uniform2f(this.uResolution, width, height)
    gl.uniform2f(this.uSourceResolution, source.width, source.height)
    gl.uniform2f(this.uCenter, centerUvX, centerUvY)
    gl.uniform1f(this.uSz, sz)
    gl.uniform1f(this.uEffectRadiusPx, effectRadiusPx)
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

export { BLACK_HOLE_CORE_RADIUS_PX, HOLE_RADIUS_FRACTION }
