import * as THREE from 'three/webgpu'
import { getElectronAPI } from '@/lib/electron-client'

const SCREEN_W = 768
const SCREEN_H = 768
const PARTICLE_COUNT = 720
const TRAFFIC_LIGHT_COLORS = ['#ff5f57', '#febc2e', '#28c840'] as const

const LOGO_BLUE_LEFT = 0x378de5
const LOGO_BLUE_LIGHT = 0x6ec8ff
const LOGO_BLUE_DEEP = 0x2f8fff
const TERMINAL_BODY = 0x3a424c

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width
  const h = height
  const r = Math.min(radius, w / 2, h / 2)
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2 + r, -h / 2)
  shape.lineTo(w / 2 - r, -h / 2)
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  shape.lineTo(w / 2, h / 2 - r)
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  shape.lineTo(-w / 2 + r, h / 2)
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  shape.lineTo(-w / 2, -h / 2 + r)
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return shape
}

function addCapsuleBar(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): void {
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  if (len < 0.001) return
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.02, len - radius * 2), 8, 16)
  const mesh = new THREE.Mesh(geo, material)
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
  mesh.position.copy(mid)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  group.add(mesh)
}

type TerminalSequence = {
  prompt: string
  command: string
  output: string[]
}

async function resolveAppVersions(): Promise<{ appVersion: string; versionOutput: string[] }> {
  const api = getElectronAPI()
  const [appVersion, runtime] = await Promise.all([
    api.app.getVersion(),
    api.app.getRuntimeVersions(),
  ])
  return {
    appVersion,
    versionOutput: [
      `NioZy v${appVersion}`,
      `electron ${runtime.electron}`,
      `chromium ${runtime.chromium}`,
      'Built-in AI copilot  ✓',
    ],
  }
}

function buildTerminalSequences(appVersion: string, versionOutput: string[]): TerminalSequence[] {
  return [
    {
      prompt: 'niozy@local ~',
      command: 'niozy --version',
      output: versionOutput,
    },
    {
      prompt: 'niozy@local proj',
      command: 'git status',
      output: ['On branch main', 'nothing to commit, working tree clean'],
    },
    {
      prompt: 'niozy@local ~',
      command: 'ssh ops@cloud.niozy',
      output: ['Connecting...', 'Welcome to NioZy Cloud!'],
    },
    {
      prompt: 'niozy@local dev',
      command: 'npm run dev',
      output: [`> niozy@${appVersion} dev`, 'electron-vite dev  ✓ ready'],
    },
    {
      prompt: 'niozy@local ~',
      command: 'docker ps --format table',
      output: ['CONTAINER ID   IMAGE     STATUS', 'a3f21bc0d891   nginx     Up 2h'],
    },
    {
      prompt: 'niozy@local ~',
      command: 'htop --no-color',
      output: ['CPU ████████░░  78%', 'MEM ██████░░░░  62%'],
    },
    {
      prompt: 'niozy@local repo',
      command: 'git log --oneline -3',
      output: ['feat: webgpu welcome scene', 'fix: terminal attach pty', 'chore: bump deps'],
    },
  ]
}

/** buildTerminalSequences 演示文本的打印速度（字符/秒）；初版约 28 / 36，现减半 */
const TERMINAL_SEQUENCE_TYPING = {
  commandCharsPerSec: 14,
  outputCharsPerSec: 18,
} as const

type TerminalPhase = 'typing-cmd' | 'typing-out' | 'hold' | 'clearing'

type TerminalState = {
  seqIndex: number
  outLineIndex: number
  charIndex: number
  phase: TerminalPhase
  holdElapsed: number
  lines: string[]
  cmdTyped: string
  cursorOn: boolean
  cursorBlink: number
}

type WebGpuBackend = { isWebGPUBackend?: boolean }

export interface WelcomeTerminalEngineOptions {
  /** 鼠标跟随；终端闲置层应设为 false */
  interactive?: boolean
  /** 精简粒子数量，适合终端内嵌区域 */
  compact?: boolean
}

export class WelcomeTerminalEngine {
  private readonly container: HTMLElement
  private readonly clock = new THREE.Clock()
  private readonly interactive: boolean
  private readonly compact: boolean

  private renderer: THREE.WebGPURenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private terminalGroup: THREE.Group | null = null
  private particles: THREE.InstancedMesh | null = null
  private particleSeeds: Float32Array | null = null

  private screenCanvas: HTMLCanvasElement | null = null
  private screenCtx: CanvasRenderingContext2D | null = null
  private screenTexture: THREE.CanvasTexture | null = null
  private terminalSequences: TerminalSequence[] = []

  private resizeObserver: ResizeObserver | null = null
  private disposed = false
  private pointerBound = false

  /** 归一化指针位置 [-1, 1] */
  private readonly pointerTarget = { x: 0, y: 0 }
  private readonly smoothedLook = { x: 0, y: 0 }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.container.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const { clientX: x, clientY: y } = event
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      this.pointerTarget.x = 0
      this.pointerTarget.y = 0
      return
    }
    this.pointerTarget.x = ((x - rect.left) / rect.width) * 2 - 1
    this.pointerTarget.y = ((y - rect.top) / rect.height) * 2 - 1
  }

  private readonly onPointerLeave = (): void => {
    this.pointerTarget.x = 0
    this.pointerTarget.y = 0
  }

  private terminalState: TerminalState = {
    seqIndex: 0,
    outLineIndex: -1,
    charIndex: 0,
    phase: 'typing-cmd',
    holdElapsed: 0,
    lines: [],
    cmdTyped: '',
    cursorOn: true,
    cursorBlink: 0,
  }

  /** 打字速度小数累积，避免每帧至少 1 字导致调速失效 */
  private typingCharCarry = 0

  isUsingWebGpu = false

  constructor(container: HTMLElement, options: WelcomeTerminalEngineOptions = {}) {
    this.container = container
    this.interactive = options.interactive ?? true
    this.compact = options.compact === true
  }

  async init(): Promise<void> {
    const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    this.renderer = renderer

    await renderer.init()
    this.isUsingWebGpu =
      (renderer.backend as WebGpuBackend).isWebGPUBackend === true
    if (!this.isUsingWebGpu) return

    const { appVersion, versionOutput } = await resolveAppVersions()
    this.terminalSequences = buildTerminalSequences(appVersion, versionOutput)

    this.container.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    this.camera.position.set(0, 0.15, 5.8)
    this.camera.lookAt(0.1, 0.05, 0)

    this.buildEnvironment()
    this.buildTerminal()
    this.buildParticles()
  }

  start(): void {
    if (!this.renderer || !this.isUsingWebGpu) return
    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    if (this.interactive) {
      this.bindPointerHandlers()
    }
    this.renderer.setAnimationLoop(() => this.animate())
  }

  private bindPointerHandlers(): void {
    if (this.pointerBound) return
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('blur', this.onPointerLeave)
    this.pointerBound = true
  }

  private unbindPointerHandlers(): void {
    if (!this.pointerBound) return
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('blur', this.onPointerLeave)
    this.pointerBound = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.renderer?.setAnimationLoop(null)
    this.resizeObserver?.disconnect()
    this.unbindPointerHandlers()

    const canvas = this.renderer?.domElement
    if (canvas?.parentElement === this.container) {
      this.container.removeChild(canvas)
    }

    this.screenTexture?.dispose()
    this.particles?.geometry.dispose()
    if (this.particles?.material instanceof THREE.Material) {
      this.particles.material.dispose()
    }

    this.terminalGroup?.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const mat of mats) mat.dispose()
      }
    })

    this.renderer?.dispose()
    this.renderer = null
    this.scene = null
    this.camera = null
  }

  private buildEnvironment(): void {
    const scene = this.scene!
    scene.fog = new THREE.FogExp2(0x080a10, 0.055)
    scene.add(new THREE.AmbientLight(0x8ab4d8, 0.42))
    const key = new THREE.PointLight(0x7ec8ff, 2.2, 16, 2)
    key.position.set(1.8, 2.2, 4.5)
    scene.add(key)
    const fill = new THREE.PointLight(0x4a90e2, 1.1, 12, 2)
    fill.position.set(-2.8, 0.4, 2.5)
    scene.add(fill)
  }

  private buildTerminal(): void {
    const group = new THREE.Group()
    this.terminalGroup = group

    const nLeftMat = new THREE.MeshStandardMaterial({
      color: LOGO_BLUE_LEFT,
      emissive: 0x1f5a9e,
      emissiveIntensity: 0.28,
      metalness: 0.2,
      roughness: 0.36,
    })
    const nDeepMat = new THREE.MeshStandardMaterial({
      color: LOGO_BLUE_DEEP,
      emissive: 0x0f3f80,
      emissiveIntensity: 0.4,
      metalness: 0.3,
      roughness: 0.32,
    })

    const nZ = -0.22
    addCapsuleBar(
      group,
      new THREE.Vector3(-1.55, -0.95, nZ),
      new THREE.Vector3(-1.55, 1.0, nZ),
      0.24,
      nLeftMat,
    )
    addCapsuleBar(
      group,
      new THREE.Vector3(-1.55, 1.0, nZ),
      new THREE.Vector3(0.42, -0.95, nZ - 0.04),
      0.24,
      nDeepMat,
    )
    addCapsuleBar(
      group,
      new THREE.Vector3(0.42, -0.95, nZ - 0.08),
      new THREE.Vector3(0.42, 0.55, nZ - 0.08),
      0.22,
      nDeepMat,
    )

    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 48),
      new THREE.MeshBasicMaterial({
        color: LOGO_BLUE_LIGHT,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    halo.position.set(0.05, 0.02, -0.55)
    group.add(halo)

    const termW = 2.15
    const termH = 2.15
    const termCenter = new THREE.Vector3(0.58, 0.04, 0.06)
    const shellGeo = new THREE.ExtrudeGeometry(roundedRectShape(termW, termH, 0.28), {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 5,
      curveSegments: 16,
    })
    const shellMat = new THREE.MeshStandardMaterial({
      color: TERMINAL_BODY,
      metalness: 0.18,
      roughness: 0.72,
    })
    const shell = new THREE.Mesh(shellGeo, shellMat)
    shell.position.copy(termCenter)
    group.add(shell)

    const rimGeo = new THREE.ExtrudeGeometry(roundedRectShape(termW + 0.06, termH + 0.06, 0.3), {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
      curveSegments: 12,
    })
    const rim = new THREE.Mesh(
      rimGeo,
      new THREE.MeshStandardMaterial({
        color: 0x4a5562,
        metalness: 0.35,
        roughness: 0.55,
      }),
    )
    rim.position.set(termCenter.x, termCenter.y, termCenter.z - 0.06)
    group.add(rim)

    const traffic = [
      { color: 0xff5f57, x: -0.72 },
      { color: 0xfebc2e, x: -0.52 },
      { color: 0x28c840, x: -0.32 },
    ] as const
    for (const dot of traffic) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 14, 14),
        new THREE.MeshStandardMaterial({
          color: dot.color,
          emissive: dot.color,
          emissiveIntensity: 0.55,
          roughness: 0.35,
        }),
      )
      light.position.set(termCenter.x + dot.x, termCenter.y + 0.82, termCenter.z + 0.14)
      group.add(light)
    }

    this.screenCanvas = document.createElement('canvas')
    this.screenCanvas.width = SCREEN_W
    this.screenCanvas.height = SCREEN_H
    this.screenCtx = this.screenCanvas.getContext('2d')
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas)
    this.screenTexture.colorSpace = THREE.SRGBColorSpace
    this.screenTexture.minFilter = THREE.LinearFilter
    this.screenTexture.magFilter = THREE.LinearFilter

    const screenSize = 1.78
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      toneMapped: false,
    })
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenSize, screenSize), screenMat)
    screen.position.set(termCenter.x, termCenter.y - 0.06, termCenter.z + 0.28)
    screen.renderOrder = 5
    group.add(screen)

    const screenGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(screenSize * 1.04, screenSize * 1.04),
      new THREE.MeshBasicMaterial({
        color: 0x6ec8ff,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    screenGlow.position.set(termCenter.x, termCenter.y - 0.06, termCenter.z + 0.26)
    screenGlow.renderOrder = 4
    group.add(screenGlow)

    group.position.set(0, 0, 0)
    group.scale.setScalar(0.8)
    this.scene!.add(group)
    this.drawTerminalFrame(true)
  }

  private buildParticles(): void {
    const particleCount = this.compact ? 180 : PARTICLE_COUNT
    const seeds = new Float32Array(particleCount * 3)
    const dummy = new THREE.Object3D()
    const geometry = new THREE.SphereGeometry(0.025, 6, 6)
    const material = new THREE.MeshBasicMaterial({
      color: 0x8ecfff,
      transparent: true,
      opacity: 0.45,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, particleCount)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let i = 0; i < particleCount; i++) {
      const radius = 6 + Math.random() * 14
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      seeds[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      seeds[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.55
      seeds[i * 3 + 2] = radius * Math.cos(phi) - 8
      dummy.position.set(seeds[i * 3]!, seeds[i * 3 + 1]!, seeds[i * 3 + 2]!)
      const s = 0.4 + Math.random() * 1.4
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    this.particleSeeds = seeds
    this.particles = mesh
    this.scene!.add(mesh)
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return
    const { clientWidth: w, clientHeight: h } = this.container
    if (w <= 0 || h <= 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
  }

  private animate(): void {
    if (!this.renderer || !this.scene || !this.camera) return
    const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()

    this.updateTerminal(delta)
    this.updateTerminalMotion(delta, elapsed)
    this.updateParticles(elapsed)
    this.renderer.render(this.scene, this.camera)
  }

  private updateTerminalMotion(delta: number, elapsed: number): void {
    if (!this.terminalGroup || !this.camera) return

    const follow = 1 - Math.exp(-7 * delta)
    this.smoothedLook.x += (this.pointerTarget.x - this.smoothedLook.x) * follow
    this.smoothedLook.y += (this.pointerTarget.y - this.smoothedLook.y) * follow

    const maxYaw = 0.42
    const maxPitch = 0.28
    const idleY = Math.sin(elapsed * 0.22) * 0.035
    const idleX = Math.sin(elapsed * 0.17) * 0.025
    const idleFloat = Math.sin(elapsed * 0.45) * 0.05

    this.terminalGroup.rotation.y = this.smoothedLook.x * maxYaw + idleY
    this.terminalGroup.rotation.x = this.smoothedLook.y * maxPitch + idleX
    this.terminalGroup.rotation.z = -this.smoothedLook.x * 0.06
    this.terminalGroup.position.y = idleFloat

    const camR = 5.8 + Math.sin(elapsed * 0.1) * 0.12
    this.camera.position.x = this.smoothedLook.x * 0.5
    this.camera.position.z = camR
    this.camera.position.y =
      0.15 + this.smoothedLook.y * 0.1 + Math.sin(elapsed * 0.14) * 0.05
    this.camera.lookAt(
      0.1 + this.smoothedLook.x * 0.1,
      0.02 + this.smoothedLook.y * 0.07,
      0,
    )
  }

  private updateParticles(elapsed: number): void {
    if (!this.particles || !this.particleSeeds) return
    const particleCount = this.particleSeeds.length / 3
    const dummy = new THREE.Object3D()
    for (let i = 0; i < particleCount; i++) {
      const sx = this.particleSeeds[i * 3]!
      const sy = this.particleSeeds[i * 3 + 1]!
      const sz = this.particleSeeds[i * 3 + 2]!
      const wobble = Math.sin(elapsed * 0.35 + i * 0.17) * 0.15
      dummy.position.set(sx + wobble, sy + wobble * 0.5, sz)
      dummy.rotation.y = elapsed * 0.2 + i
      const pulse = 0.55 + Math.sin(elapsed * 1.4 + i * 0.31) * 0.35
      dummy.scale.setScalar(pulse)
      dummy.updateMatrix()
      this.particles.setMatrixAt(i, dummy.matrix)
    }
    this.particles.instanceMatrix.needsUpdate = true
  }

  private updateTerminal(delta: number): void {
    const state = this.terminalState
    state.cursorBlink += delta
    if (state.cursorBlink >= 0.45) {
      state.cursorBlink = 0
      state.cursorOn = !state.cursorOn
    }

    const seq = this.terminalSequences[state.seqIndex % this.terminalSequences.length]
    if (!seq) return

    if (state.phase === 'typing-cmd') {
      const full = seq.command
      if (state.charIndex < full.length) {
        state.charIndex = this.advanceTypingChars(
          delta,
          TERMINAL_SEQUENCE_TYPING.commandCharsPerSec,
          state.charIndex,
          full.length,
        )
        state.cmdTyped = full.slice(0, state.charIndex)
        this.drawTerminalFrame(true)
      } else {
        this.typingCharCarry = 0
        state.phase = 'typing-out'
        state.outLineIndex = 0
        state.charIndex = 0
        state.lines = [`> ${seq.command}`]
        this.drawTerminalFrame(true)
      }
      return
    }

    if (state.phase === 'typing-out') {
      const line = seq.output[state.outLineIndex]
      if (!line) {
        this.typingCharCarry = 0
        state.phase = 'hold'
        state.holdElapsed = 0
        this.drawTerminalFrame(true)
        return
      }
      state.charIndex = this.advanceTypingChars(
        delta,
        TERMINAL_SEQUENCE_TYPING.outputCharsPerSec,
        state.charIndex,
        line.length,
      )
      const partial = line.slice(0, state.charIndex)
      const nextLines = [...state.lines.slice(0, state.outLineIndex + 1), partial]
      state.lines = nextLines
      if (state.charIndex >= line.length) {
        this.typingCharCarry = 0
        state.outLineIndex += 1
        state.charIndex = 0
      }
      this.drawTerminalFrame(true)
      return
    }

    if (state.phase === 'hold') {
      state.holdElapsed += delta
      if (state.holdElapsed > 1.8) {
        state.phase = 'clearing'
        state.holdElapsed = 0
        state.lines = []
        state.cmdTyped = ''
      }
      this.drawTerminalFrame(true)
      return
    }

    if (state.phase === 'clearing') {
      state.holdElapsed += delta
      if (state.holdElapsed > 0.35) {
        this.typingCharCarry = 0
        state.seqIndex = (state.seqIndex + 1) % this.terminalSequences.length
        state.outLineIndex = 0
        state.charIndex = 0
        state.phase = 'typing-cmd'
        state.lines = []
        state.cmdTyped = ''
        state.holdElapsed = 0
      }
      this.drawTerminalFrame(true)
    }
  }

  private advanceTypingChars(
    delta: number,
    charsPerSec: number,
    currentIndex: number,
    maxLength: number,
  ): number {
    this.typingCharCarry += delta * charsPerSec
    let next = currentIndex
    while (this.typingCharCarry >= 1 && next < maxLength) {
      next += 1
      this.typingCharCarry -= 1
    }
    return next
  }

  private drawMacTrafficLights(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const radius = 9
    const gap = 10
    for (let i = 0; i < TRAFFIC_LIGHT_COLORS.length; i++) {
      const cx = x + i * (radius * 2 + gap)
      ctx.beginPath()
      ctx.arc(cx, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = TRAFFIC_LIGHT_COLORS[i]!
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth = 1
      ctx.stroke()
      const highlight = ctx.createRadialGradient(cx - 2, y - 2, 0, cx, y, radius)
      highlight.addColorStop(0, 'rgba(255,255,255,0.45)')
      highlight.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = highlight
      ctx.beginPath()
      ctx.arc(cx, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawTerminalFrame(_forceTextureUpdate: boolean): void {
    const ctx = this.screenCtx
    const canvas = this.screenCanvas
    const texture = this.screenTexture
    if (!ctx || !canvas || !texture) return

    const seq = this.terminalSequences[this.terminalState.seqIndex % this.terminalSequences.length]
    if (!seq) return
    const bg = '#1e2430'
    const fg = '#f4f6fa'
    const accent = '#7dd3fc'
    const dim = '#8b95a3'
    const warn = '#febc2e'

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

    for (let y = 0; y < SCREEN_H; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.fillRect(0, y, SCREEN_W, 1)
    }

    const margin = 48
    const titleBarH = 52
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, 0, SCREEN_W, titleBarH)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, titleBarH)
    ctx.lineTo(SCREEN_W, titleBarH)
    ctx.stroke()
    this.drawMacTrafficLights(ctx, margin, titleBarH / 2)

    const topPad = 72
    let y = topPad
    const lineH = 38
    const font =
      '26px Consolas, "Cascadia Mono", "Segoe UI Mono", "Courier New", monospace'
    ctx.font = font
    ctx.textBaseline = 'top'

    if (this.terminalState.phase === 'typing-cmd') {
      ctx.fillStyle = fg
      ctx.fillText('> ', margin, y)
      ctx.fillStyle = accent
      ctx.fillText(this.terminalState.cmdTyped, margin + ctx.measureText('> ').width, y)
    } else {
      for (const line of this.terminalState.lines) {
        if (line.startsWith('> ')) {
          ctx.fillStyle = fg
          const gt = line.indexOf(' ')
          ctx.fillText('> ', margin, y)
          ctx.fillStyle = accent
          ctx.fillText(line.slice(gt + 1), margin + ctx.measureText('> ').width, y)
        } else if (line.startsWith(seq.prompt)) {
          ctx.fillStyle = dim
          ctx.fillText(line, margin, y)
        } else {
          ctx.fillStyle = line.includes('✓') ? accent : line.includes('█') ? warn : fg
          ctx.fillText(line, margin, y)
        }
        y += lineH
      }
    }

    if (this.terminalState.cursorOn) {
      let cursorX = margin
      let cursorY = topPad
      if (this.terminalState.phase === 'typing-cmd') {
        cursorX += ctx.measureText(`> ${this.terminalState.cmdTyped}`).width + 4
      } else if (this.terminalState.phase === 'typing-out') {
        const active = this.terminalState.lines[this.terminalState.lines.length - 1] ?? ''
        cursorX += ctx.measureText(active).width + 4
        cursorY = topPad + Math.max(0, this.terminalState.lines.length - 1) * lineH
      }
      ctx.fillStyle = fg
      ctx.fillRect(cursorX, cursorY + 5, 12, 24)
    }

    texture.needsUpdate = true
  }
}
