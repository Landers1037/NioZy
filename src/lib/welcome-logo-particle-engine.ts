import * as THREE from 'three/webgpu'
import logoUrl from '@/logo.png'

/** 中等密度：512×522 logo 约 1.5 万颗可见粒子 */
const SAMPLE_STEP = 4
const MIN_ALPHA = 48
const SPHERE_RADIUS = 0.011
/** 水平方向占可用区域比例 */
const FIT_WIDTH_RATIO = 0.72
/** 垂直方向占可用区域比例（为底部文案留空） */
const FIT_HEIGHT_RATIO = 0.58

/** 鼠标排斥半径（logo 局部坐标） */
const REPEL_RADIUS = 0.06
/** 点击打散半径 */
const CLICK_RADIUS = 0.20
/** 点击冲量强度 */
const CLICK_IMPULSE = 18
/** 点击直接位移（立即打散） */
const CLICK_DISPLACE = 0.18
/** 点击影响衰减时长（秒） */
const CLICK_BURST_DURATION = 2
/** 位移回弹刚度 / 阻尼（交互中 vs 恢复中） */
const SPRING_STIFFNESS_ACTIVE = 4.5
const SPRING_DAMPING_ACTIVE = 4.5
const SPRING_STIFFNESS_IDLE = 18
const SPRING_DAMPING_IDLE = 10
/** 鼠标离开 logo 区域后，位移指数衰减（越大回弹越快） */
const RECOVERY_DECAY = 11
/** 鼠标排斥：速度冲量 + 随鼠标位移的瞬时推开（非每帧累加） */
const REPEL_VELOCITY = 550
const REPEL_DRAG = 14
const MAX_DISPLACE = 0.25

interface ClickBurst {
  x: number
  y: number
  t: number
}

type WebGpuBackend = { isWebGPUBackend?: boolean }
type WelcomeRenderer = THREE.WebGPURenderer | THREE.WebGLRenderer

interface LogoBounds {
  width: number
  height: number
}

interface ParticleSample {
  homeX: number
  homeY: number
  homeZ: number
  color: THREE.Color
  phase: number
  size: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('failed to load logo'))
    img.src = url
  })
}

async function sampleLogoParticles(
  url: string,
  step: number,
): Promise<{ particles: ParticleSample[]; bounds: LogoBounds }> {
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d unavailable')

  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  const raw: Array<{ x: number; y: number; color: THREE.Color }> = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if ((data[i + 3] ?? 0) < MIN_ALPHA) continue

      raw.push({
        x,
        y,
        color: new THREE.Color(
          (data[i] ?? 0) / 255,
          (data[i + 1] ?? 0) / 255,
          (data[i + 2] ?? 0) / 255,
        ),
      })
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  if (raw.length === 0) {
    return { particles: [], bounds: { width: 1, height: 1 } }
  }

  const contentW = maxX - minX + step
  const contentH = maxY - minY + step
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const norm = 1 / Math.max(contentW, contentH)

  const particles = raw.map(({ x, y, color }) => ({
    homeX: (x - centerX) * norm,
    homeY: -(y - centerY) * norm,
    homeZ: (Math.random() - 0.5) * 0.04,
    color,
    phase: Math.random() * Math.PI * 2,
    size: 0.88 + Math.random() * 0.28,
  }))

  const spherePad = SPHERE_RADIUS * 2.4
  return {
    particles,
    bounds: {
      width: contentW * norm + spherePad,
      height: contentH * norm + spherePad,
    },
  }
}

async function createWelcomeRenderer(): Promise<{
  renderer: WelcomeRenderer
  isWebGpu: boolean
}> {
  const pixelRatio = Math.min(window.devicePixelRatio, 2)

  const webgpuRenderer = new THREE.WebGPURenderer({ antialias: true, alpha: true })
  webgpuRenderer.setClearColor(0x000000, 0)
  try {
    await webgpuRenderer.init()
    const isWebGpu =
      (webgpuRenderer.backend as WebGpuBackend).isWebGPUBackend === true
    if (isWebGpu) {
      webgpuRenderer.setPixelRatio(pixelRatio)
      return { renderer: webgpuRenderer, isWebGpu: true }
    }
    webgpuRenderer.dispose()
  } catch {
    webgpuRenderer.dispose()
  }

  const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  webglRenderer.setPixelRatio(pixelRatio)
  webglRenderer.setClearColor(0x000000, 0)
  return { renderer: webglRenderer, isWebGpu: false }
}

export class WelcomeLogoParticleEngine {
  private renderer: WelcomeRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private particleRoot: THREE.Group | null = null
  private instancedMesh: THREE.InstancedMesh | null = null
  private particles: ParticleSample[] = []
  private logoBounds: LogoBounds = { width: 1, height: 1 }
  private displacements: Float32Array = new Float32Array(0)
  private velocities: Float32Array = new Float32Array(0)
  private bursts: ClickBurst[] = []
  private clock = new THREE.Clock()
  private resizeObserver: ResizeObserver | null = null
  private pointerBound = false
  private onWindowPointerMove: ((e: PointerEvent) => void) | null = null
  private onWindowPointerDown: ((e: PointerEvent) => void) | null = null
  private pointerOver = false
  private mouseLocalValid = false
  private lastPointerClientX = 0
  private lastPointerClientY = 0
  private mouse = new THREE.Vector2(0, 0)
  private mouseLocal = new THREE.Vector3()
  private prevMouseLocal = new THREE.Vector3()
  private hasPrevMouseLocal = false
  private mouseMoveSpeed = 0
  private targetTilt = new THREE.Vector2(0, 0)
  private currentTilt = new THREE.Vector2(0, 0)
  private dummy = new THREE.Object3D()
  private brushCursor: HTMLDivElement | null = null
  private brushCenterWorld = new THREE.Vector3()
  private brushEdgeWorld = new THREE.Vector3()
  private brushCenterNdc = new THREE.Vector3()
  private brushEdgeNdc = new THREE.Vector3()
  private brushCursorVisible = false

  isUsingWebGpu = false

  constructor(private readonly host: HTMLElement) {}

  async init(): Promise<void> {
    const sampled = await sampleLogoParticles(logoUrl, SAMPLE_STEP)
    this.particles = sampled.particles
    this.logoBounds = sampled.bounds
    if (this.particles.length === 0) throw new Error('no logo particles sampled')

    const n = this.particles.length
    this.displacements = new Float32Array(n * 3)
    this.velocities = new Float32Array(n * 3)

    const scene = new THREE.Scene()
    this.scene = scene

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    this.camera = camera

    const root = new THREE.Group()
    scene.add(root)
    this.particleRoot = root

    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 10, 10)
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.38,
      metalness: 0.12,
      vertexColors: false,
    })

    const mesh = new THREE.InstancedMesh(geometry, material, this.particles.length)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const colors = new Float32Array(this.particles.length * 3)
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!
      p.color.toArray(colors, i * 3)
      this.dummy.position.set(p.homeX, p.homeY, p.homeZ)
      this.dummy.scale.setScalar(p.size)
      this.dummy.updateMatrix()
      mesh.setMatrixAt(i, this.dummy.matrix)
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    root.add(mesh)
    this.instancedMesh = mesh

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85)
    keyLight.position.set(2.5, 2, 4)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.35)
    fillLight.position.set(-3, -1, 2)
    scene.add(fillLight)

    const { renderer, isWebGpu } = await createWelcomeRenderer()
    this.renderer = renderer
    this.isUsingWebGpu = isWebGpu

    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'none'
    this.host.appendChild(renderer.domElement)

    this.host.style.cursor = 'none'
    const brush = document.createElement('div')
    brush.className = 'welcome-particle-brush-cursor'
    brush.style.display = 'none'
    this.host.appendChild(brush)
    this.brushCursor = brush

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.host)
    this.handleResize()
    this.bindPointerHandlers()
  }

  start(): void {
    if (!this.renderer) return
    if (!this.pointerBound) this.bindPointerHandlers()
    this.clock.start()
    this.renderer.setAnimationLoop(() => this.tick())
  }

  private getInteractionRect(): DOMRect {
    return (this.renderer?.domElement ?? this.host).getBoundingClientRect()
  }

  private isPointerInside(clientX: number, clientY: number): boolean {
    const rect = this.getInteractionRect()
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    )
  }

  private setMouseFromClient(clientX: number, clientY: number): void {
    const rect = this.getInteractionRect()
    if (rect.width <= 0 || rect.height <= 0) return
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  }

  /**
   * 屏幕坐标 → logo 局部平面（与 updateViewportFit 布局一致，不依赖射线求交）
   */
  private mapClientToLogoLocal(clientX: number, clientY: number): boolean {
    const rect = this.getInteractionRect()
    if (rect.width <= 0 || rect.height <= 0) return false

    const u = (clientX - rect.left) / rect.width
    const v = (clientY - rect.top) / rect.height
    const { width, height } = this.logoBounds
    const centerY = 0.5 - 0.035

    this.mouseLocal.set(
      (u - 0.5) * (width / FIT_WIDTH_RATIO),
      -(v - centerY) * (height / FIT_HEIGHT_RATIO),
      0,
    )
    return true
  }

  private handlePointerAt(clientX: number, clientY: number): void {
    this.lastPointerClientX = clientX
    this.lastPointerClientY = clientY
    this.setMouseFromClient(clientX, clientY)
    this.mouseLocalValid = this.mapClientToLogoLocal(clientX, clientY)
  }

  private triggerClickBurst(): void {
    if (!this.mouseLocalValid) return
    const elapsed = this.clock.getElapsedTime()
    this.bursts.push({
      x: this.mouseLocal.x,
      y: this.mouseLocal.y,
      t: elapsed,
    })
    if (this.bursts.length > 8) {
      this.bursts.shift()
    }
    this.applyClickImpulse(this.mouseLocal.x, this.mouseLocal.y, 1)
  }

  /** logo 内容包围盒（不含 canvas 黑边映射区） */
  private isMouseNearLogoBounds(): boolean {
    const { width, height } = this.logoBounds
    const halfW = width * 0.5
    const halfH = height * 0.5
    return (
      Math.abs(this.mouseLocal.x) <= halfW &&
      Math.abs(this.mouseLocal.y) <= halfH
    )
  }

  /** 排斥半径（logo 局部 → 屏幕像素，与 3D 透视投影一致） */
  private getRepelRadiusScreenPx(clientX: number, clientY: number): number {
    const camera = this.camera
    const root = this.particleRoot
    const rect = this.getInteractionRect()
    if (!camera || !root || rect.width <= 0 || rect.height <= 0) return 0
    if (!this.mapClientToLogoLocal(clientX, clientY)) return 0

    root.updateMatrixWorld(true)

    this.brushCenterWorld.set(this.mouseLocal.x, this.mouseLocal.y, 0).applyMatrix4(root.matrixWorld)
    this.brushEdgeWorld
      .set(this.mouseLocal.x + REPEL_RADIUS, this.mouseLocal.y, 0)
      .applyMatrix4(root.matrixWorld)

    this.brushCenterNdc.copy(this.brushCenterWorld).project(camera)
    this.brushEdgeNdc.copy(this.brushEdgeWorld).project(camera)

    const cx = (this.brushCenterNdc.x * 0.5 + 0.5) * rect.width
    const cy = (-this.brushCenterNdc.y * 0.5 + 0.5) * rect.height
    const ex = (this.brushEdgeNdc.x * 0.5 + 0.5) * rect.width
    const ey = (-this.brushEdgeNdc.y * 0.5 + 0.5) * rect.height

    return Math.hypot(ex - cx, ey - cy)
  }

  private updateBrushCursor(clientX: number, clientY: number, visible: boolean): void {
    const brush = this.brushCursor
    if (!brush) return
    this.brushCursorVisible = visible
    if (!visible) {
      brush.style.display = 'none'
      return
    }
    const rect = this.getInteractionRect()
    const radius = this.getRepelRadiusScreenPx(clientX, clientY)
    if (radius <= 0) {
      brush.style.display = 'none'
      this.brushCursorVisible = false
      return
    }
    const x = clientX - rect.left
    const y = clientY - rect.top
    brush.style.display = 'block'
    brush.style.width = `${radius * 2}px`
    brush.style.height = `${radius * 2}px`
    brush.style.left = `${x - radius}px`
    brush.style.top = `${y - radius}px`
  }

  private bindPointerHandlers(): void {
    if (this.pointerBound) return

    this.onWindowPointerMove = (e: PointerEvent) => {
      if (!this.isPointerInside(e.clientX, e.clientY)) {
        this.pointerOver = false
        this.mouseLocalValid = false
        this.hasPrevMouseLocal = false
        this.updateBrushCursor(e.clientX, e.clientY, false)
        return
      }
      this.handlePointerAt(e.clientX, e.clientY)
      const nearLogo = this.isMouseNearLogoBounds()
      this.pointerOver = nearLogo
      this.updateBrushCursor(e.clientX, e.clientY, true)
      if (!nearLogo) {
        this.hasPrevMouseLocal = false
      }
    }

    this.onWindowPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (!this.isPointerInside(e.clientX, e.clientY)) return
      this.handlePointerAt(e.clientX, e.clientY)
      if (!this.isMouseNearLogoBounds()) return
      this.pointerOver = true
      this.triggerClickBurst()
    }

    window.addEventListener('pointermove', this.onWindowPointerMove, { passive: true })
    window.addEventListener('pointerdown', this.onWindowPointerDown)
    window.addEventListener('pointerout', this.onWindowPointerMove)
    this.pointerBound = true
  }

  private unbindPointerHandlers(): void {
    if (!this.pointerBound) return
    if (this.onWindowPointerMove) {
      window.removeEventListener('pointermove', this.onWindowPointerMove)
      window.removeEventListener('pointerout', this.onWindowPointerMove)
      this.onWindowPointerMove = null
    }
    if (this.onWindowPointerDown) {
      window.removeEventListener('pointerdown', this.onWindowPointerDown)
      this.onWindowPointerDown = null
    }
    this.pointerBound = false
    this.pointerOver = false
    this.mouseLocalValid = false
  }

  dispose(): void {
    this.renderer?.setAnimationLoop(null)
    this.unbindPointerHandlers()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.bursts = []
    this.displacements = new Float32Array(0)
    this.velocities = new Float32Array(0)

    const mesh = this.instancedMesh
    if (mesh) {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    this.renderer?.dispose()
    this.brushCursor?.remove()
    this.brushCursor = null
    this.host.style.cursor = ''
    this.renderer?.domElement.remove()
    this.renderer = null
    this.scene = null
    this.camera = null
    this.particleRoot = null
    this.instancedMesh = null
    this.particles = []
    this.isUsingWebGpu = false
  }

  private handleResize(): void {
    const renderer = this.renderer
    const camera = this.camera
    if (!renderer || !camera) return

    const { clientWidth, clientHeight } = this.host
    if (clientWidth <= 0 || clientHeight <= 0) return

    renderer.setSize(clientWidth, clientHeight, false)
    this.updateViewportFit()
    if (this.brushCursor?.style.display !== 'none') {
      this.updateBrushCursor(this.lastPointerClientX, this.lastPointerClientY, true)
    }
  }

  /** 根据容器宽高与 logo 边界，计算相机距离使 logo 完整落入视口 */
  private updateViewportFit(): void {
    const camera = this.camera
    if (!camera) return

    const { clientWidth, clientHeight } = this.host
    if (clientWidth <= 0 || clientHeight <= 0) return

    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()

    const { width, height } = this.logoBounds
    const vFovRad = (camera.fov * Math.PI) / 180
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect)

    const distForHeight =
      height / 2 / Math.tan(vFovRad / 2) / FIT_HEIGHT_RATIO
    const distForWidth =
      width / 2 / Math.tan(hFovRad / 2) / FIT_WIDTH_RATIO
    const distance = Math.max(distForHeight, distForWidth) * 1.08

    const verticalBias = height * 0.08
    camera.position.set(0, 0, distance)
    camera.lookAt(0, -verticalBias, 0)
  }

  /** 点击时给范围内粒子施加径向冲量 + 直接位移 */
  private applyClickImpulse(cx: number, cy: number, strength: number): void {
    const n = this.particles.length
    const radiusSq = CLICK_RADIUS * CLICK_RADIUS

    for (let i = 0; i < n; i++) {
      const p = this.particles[i]!
      const di = i * 3
      const px = p.homeX + this.displacements[di]!
      const py = p.homeY + this.displacements[di + 1]!
      const dx = px - cx
      const dy = py - cy
      const distSq = dx * dx + dy * dy
      if (distSq > radiusSq || distSq < 1e-8) continue

      const dist = Math.sqrt(distSq)
      const falloff = 1 - dist / CLICK_RADIUS
      const f2 = falloff * falloff
      const nx = dx / dist
      const ny = dy / dist

      const impulse = CLICK_IMPULSE * strength * f2
      this.velocities[di]! += nx * impulse
      this.velocities[di + 1]! += ny * impulse
      this.velocities[di + 2]! += (Math.random() - 0.5) * impulse * 0.8

      const scatter = CLICK_DISPLACE * strength * f2
      this.displacements[di]! += nx * scatter
      this.displacements[di + 1]! += ny * scatter
      this.displacements[di + 2]! += (Math.random() - 0.5) * scatter * 0.5
    }
  }

  private simulateParticles(elapsed: number, dt: number): void {
    const n = this.particles.length
    const repelRadiusSq = REPEL_RADIUS * REPEL_RADIUS
    const clickRadiusSq = CLICK_RADIUS * CLICK_RADIUS

    if (this.pointerOver) {
      this.mouseLocalValid = this.mapClientToLogoLocal(
        this.lastPointerClientX,
        this.lastPointerClientY,
      )
    }

    const hasMouse = this.pointerOver && this.mouseLocalValid
    const nearLogo = hasMouse && this.isMouseNearLogoBounds()

    let frameMoveLen = 0

    if (hasMouse) {
      if (this.hasPrevMouseLocal) {
        const frameMoveDx = this.mouseLocal.x - this.prevMouseLocal.x
        const frameMoveDy = this.mouseLocal.y - this.prevMouseLocal.y
        frameMoveLen = Math.hypot(frameMoveDx, frameMoveDy)
        this.mouseMoveSpeed = frameMoveLen / Math.max(dt, 1e-4)
      } else {
        this.mouseMoveSpeed = 0
      }
      this.prevMouseLocal.copy(this.mouseLocal)
      this.hasPrevMouseLocal = true
    } else {
      this.hasPrevMouseLocal = false
      this.mouseMoveSpeed = 0
    }

    const mx = this.mouseLocal.x
    const my = this.mouseLocal.y
    /** 本帧鼠标位移越大，排斥越强；停住时为 0 */
    const moveFactor = Math.min(frameMoveLen / 0.006, 1.2)
    /** 仅在 logo 上且正在移动时排斥；其余时间强回弹 */
    const activelyRepelling = nearLogo && moveFactor > 0.02
    const recovering = !activelyRepelling
    const springK = recovering ? SPRING_STIFFNESS_IDLE : SPRING_STIFFNESS_ACTIVE
    const springD = recovering ? SPRING_DAMPING_IDLE : SPRING_DAMPING_ACTIVE
    const recoveryFactor = recovering ? Math.exp(-RECOVERY_DECAY * dt) : 1

    // 清理过期点击波
    this.bursts = this.bursts.filter((b) => elapsed - b.t < CLICK_BURST_DURATION)

    for (let i = 0; i < n; i++) {
      const p = this.particles[i]!
      const di = i * 3
      let ox = this.displacements[di]!
      let oy = this.displacements[di + 1]!
      let oz = this.displacements[di + 2]!
      let vx = this.velocities[di]!
      let vy = this.velocities[di + 1]!
      let vz = this.velocities[di + 2]!

      const floatX = Math.cos(elapsed * 0.75 + p.phase * 1.4) * 0.005
      const floatY = Math.sin(elapsed * 1.15 + p.phase) * 0.009
      const px = p.homeX + ox + floatX
      const py = p.homeY + oy + floatY

      // 鼠标移动排斥：仅在 logo 上滑动时推开
      if (activelyRepelling) {
        const dx = px - mx
        const dy = py - my
        const distSq = dx * dx + dy * dy
        if (distSq < repelRadiusSq && distSq > 1e-8) {
          const dist = Math.sqrt(distSq)
          const falloff = 1 - dist / REPEL_RADIUS
          const nx = dx / dist
          const ny = dy / dist
          const drag = REPEL_DRAG * falloff * moveFactor * frameMoveLen
          ox += nx * drag
          oy += ny * drag
          const velPush = REPEL_VELOCITY * falloff * moveFactor * dt
          vx += nx * velPush
          vy += ny * velPush
        }
      }

      // 点击余波 — 随时间衰减的持续推开
      for (const burst of this.bursts) {
        const age = elapsed - burst.t
        const fade = 1 - age / CLICK_BURST_DURATION
        const bdx = px - burst.x
        const bdy = py - burst.y
        const bDistSq = bdx * bdx + bdy * bdy
        if (bDistSq > clickRadiusSq || bDistSq < 1e-8) continue
        const bDist = Math.sqrt(bDistSq)
        const bFalloff = (1 - bDist / CLICK_RADIUS) * fade
        const bForce = bFalloff * bFalloff * 4.5 * dt
        vx += (bdx / bDist) * bForce
        vy += (bdy / bDist) * bForce
        vz += Math.sin(p.phase * 4.1) * bForce * 0.4
      }

      // 弹簧回弹至原位（鼠标离开后加强回弹）
      vx += (-springK * ox - springD * vx) * dt
      vy += (-springK * oy - springD * vy) * dt
      vz += (-springK * oz - springD * vz) * dt

      ox += vx * dt
      oy += vy * dt
      oz += vz * dt

      if (recovering) {
        ox *= recoveryFactor
        oy *= recoveryFactor
        oz *= recoveryFactor
        vx *= recoveryFactor
        vy *= recoveryFactor
        vz *= recoveryFactor
        if (Math.abs(ox) < 0.0004) ox = 0
        if (Math.abs(oy) < 0.0004) oy = 0
        if (Math.abs(oz) < 0.0004) oz = 0
      }

      const mag = Math.hypot(ox, oy, oz)
      if (mag > MAX_DISPLACE) {
        const s = MAX_DISPLACE / mag
        ox *= s
        oy *= s
        oz *= s
        vx *= 0.5
        vy *= 0.5
        vz *= 0.5
      }

      this.displacements[di] = ox
      this.displacements[di + 1] = oy
      this.displacements[di + 2] = oz
      this.velocities[di] = vx
      this.velocities[di + 1] = vy
      this.velocities[di + 2] = vz
    }
  }

  private tick = (): void => {
    const elapsed = this.clock.getElapsedTime()
    const dt = Math.min(this.clock.getDelta(), 0.033)
    const mesh = this.instancedMesh
    const root = this.particleRoot

    if (this.pointerOver) {
      this.mouseLocalValid = this.mapClientToLogoLocal(
        this.lastPointerClientX,
        this.lastPointerClientY,
      )
    }

    if (this.pointerOver && this.mouseLocalValid) {
      this.targetTilt.x = this.mouse.y * 0.14 * 0.08
      this.targetTilt.y = this.mouse.x * 0.2 * 0.08
    } else {
      this.targetTilt.x = 0
      this.targetTilt.y = 0
    }
    this.currentTilt.x += (this.targetTilt.x - this.currentTilt.x) * 0.07
    this.currentTilt.y += (this.targetTilt.y - this.currentTilt.y) * 0.07

    if (root) {
      root.rotation.x = this.currentTilt.x
      root.rotation.y = this.currentTilt.y
      root.position.y = Math.sin(elapsed * 0.55) * 0.03
    }

    if (this.brushCursorVisible) {
      this.updateBrushCursor(this.lastPointerClientX, this.lastPointerClientY, true)
    }

    this.simulateParticles(elapsed, dt)

    if (mesh) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i]!
        const di = i * 3
        const floatY = Math.sin(elapsed * 1.15 + p.phase) * 0.009
        const driftX = Math.cos(elapsed * 0.75 + p.phase * 1.4) * 0.005
        const depth = p.homeZ + Math.sin(elapsed * 0.9 + p.phase) * 0.012

        this.dummy.position.set(
          p.homeX + driftX + this.displacements[di]!,
          p.homeY + floatY + this.displacements[di + 1]!,
          depth + this.displacements[di + 2]!,
        )
        const pulse = 0.9 + 0.1 * Math.sin(elapsed * 1.8 + p.phase)
        this.dummy.scale.setScalar(p.size * pulse)
        this.dummy.updateMatrix()
        mesh.setMatrixAt(i, this.dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera)
    }
  }
}
