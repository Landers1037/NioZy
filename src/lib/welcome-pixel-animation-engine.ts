import { Application, Container, Graphics, Text } from 'pixi.js'

type StoryboardState = 'idle_1' | 'idle_2' | 'idle_3' | 'happy' | 'excited' | 'thinking'

const SCENE_W = 400
const SCENE_H = 240
const PIX = 3

const C = {
  bg: 0x050510,
  // N 3D 光照色阶 — 左亮右暗、上亮下暗
  nHi: 0xd8f4ff,   // 最亮高光（左边缘）
  nLit: 0xa0e4ff,  // 亮面
  nMid: 0x5cbcff,  // 中间调
  nBase: 0x2d8cee,  // 基础蓝
  nDeep: 0x1560cc,  // 深蓝
  nDark: 0x0a3c96,  // 暗面
  nShadow: 0x052868, // 最暗阴影
  // 终端
  termBg: 0x1a1a1a,
  termFace: 0x121212,
  termHeader: 0x222222,
  termEdge: 0x363636,
  dotR: 0xee4444,
  dotY: 0xeebb33,
  dotG: 0x33cc55,
  prompt: 0xeeeeee,
  tSparkle: 0x44ccff,
  // 平台
  platGlow: 0x55ddff,
  platBright: 0x33aaff,
  platMid: 0x1570cc,
  platDeep: 0x0a4088,
  platCore: 0x052550,
  platRim: 0x66eeff,
  // 效果
  heart: 0xff5599,
  heartHi: 0xffaacc,
  sparkYellow: 0xffd740,
  sparkPurple: 0xbb88ff,
  bubble: 0xf0f0f0,
  bubbleText: 0x222222,
} as const

const STATE_FRAMES: Record<
  StoryboardState,
  { y: number; glow: number; heart: boolean; sparkles: number; bubble: boolean; durationMs: number }
> = {
  idle_1: { y: 0, glow: 0.55, heart: false, sparkles: 0, bubble: false, durationMs: 900 },
  idle_2: { y: 4, glow: 0.40, heart: false, sparkles: 0, bubble: false, durationMs: 350 },
  idle_3: { y: -3, glow: 0.72, heart: false, sparkles: 0, bubble: false, durationMs: 350 },
  happy: { y: -12, glow: 0.90, heart: true, sparkles: 2, bubble: false, durationMs: 650 },
  excited: { y: -8, glow: 1.0, heart: false, sparkles: 4, bubble: false, durationMs: 750 },
  thinking: { y: 1, glow: 0.5, heart: false, sparkles: 0, bubble: true, durationMs: 2200 },
}

const IDLE_CYCLE: StoryboardState[] = ['idle_1', 'idle_2', 'idle_3']
const REACT_SEQUENCE: StoryboardState[] = ['happy', 'excited', 'thinking']

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

// ── 像素绘制 ──

function px(g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.rect(x * PIX, y * PIX, w * PIX, h * PIX)
  g.fill({ color, alpha })
}

function paintArt(g: Graphics, ox: number, oy: number, art: string, pal: Record<string, number>): void {
  const rows = art.split('\n').filter(r => r.length > 0)
  for (let y = 0; y < rows.length; y++) {
    const line = rows[y]!
    for (let x = 0; x < line.length; x++) {
      const ch = line[x]
      if (!ch || ch === '.') continue
      const color = pal[ch]
      if (color !== undefined) px(g, ox + x, oy + y, 1, 1, color)
    }
  }
}

// ── N 标志 ──
// 原型里的 N 不是单层背景：左柱在后方，粗斜杠有一段压在终端左下方前面。
// 因此这里拆成 N_BACK_ART + N_FRONT_ART，避免终端把 N 的连续性全部盖掉。

const N_PAL: Record<string, number> = {
  H: C.nHi, L: C.nLit, M: C.nMid, B: C.nBase,
  D: C.nDeep, K: C.nDark, S: C.nShadow,
}

const N_BACK_ART = [
  '.HLMB...................',
  '.HLMB...................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HLMBD....................',
  'HMBDK....................',
  'HMBDK....................',
  'HMBDK....................',
  'HMBDK....................',
  '.MBDK....................',
  '.MBDK....................',
  '.MBDK....................',
  '.MBDK....................',
  '..MBDK....................',
  '..MBDK....................',
].join('\n')

// 前景斜杠：顶行与竖笔对齐，每 2 行右移 1 格（缓斜）
const N_FRONT_ART = [
  '....HLMB................', // 0  顶对齐 x=4
  '....HLMB................', // 1
  '....HLMBD...............', // 2
  '....HLMBD...............', // 3
  '.....HLMBD..............', // 4
  '.....HLMBD..............', // 5
  '......HLMBD.............', // 6
  '......HLMBD.............', // 7
  '.......HLMBD............', // 8
  '.......HLMBD............', // 9
  '........HLMBD...........', // 10
  '........HLMBD...........', // 11
  '.........HLMBD..........', // 12
  '.........HLMBD..........', // 13
  '..........HLMBD.........', // 14
  '..........HLMBD.........', // 15
  '...........HMBDK........', // 16
  '...........HMBDK........', // 17
  '............HMBDK.......', // 18
  '............HMBDK.......', // 19
  '.............MBDK.......', // 20
  '.............MBDK.......', // 21
  '..............MBDK......', // 22
  '..............BDK.......', // 23
  '...............DK.......', // 24
  '...............S........', // 25
].join('\n')

function drawLogoN(g: Graphics, ox: number, oy: number): void {
  paintArt(g, ox, oy, N_BACK_ART, N_PAL)
}

function drawLogoNForeground(g: Graphics, ox: number, oy: number): void {
  paintArt(g, ox, oy, N_FRONT_ART, N_PAL)
}

// ── 终端窗口 ──
// 原型：圆角深色矩形，标题栏有红/黄/绿 圆点，内容区有 >_ 提示符

function drawTerminal(g: Graphics, ox: number, oy: number, cursorVisible: boolean): void {
  const w = 24
  const h = 16

  // 外框圆角
  px(g, ox + 2, oy, w - 4, 1, C.termEdge)
  px(g, ox + 1, oy + 1, w - 2, 1, C.termEdge)
  px(g, ox, oy + 2, w, h - 4, C.termEdge)
  px(g, ox + 1, oy + h - 2, w - 2, 1, C.termEdge)
  px(g, ox + 2, oy + h - 1, w - 4, 1, C.termEdge)

  // 内面
  px(g, ox + 2, oy + 1, w - 4, 1, C.termFace)
  px(g, ox + 1, oy + 2, w - 2, h - 5, C.termFace)
  px(g, ox + 2, oy + h - 3, w - 4, 1, C.termFace)
  px(g, ox + 2, oy + h - 2, w - 4, 1, C.termFace)

  // 标题栏
  px(g, ox + 2, oy + 1, w - 4, 1, C.termHeader)
  px(g, ox + 1, oy + 2, w - 2, 2, C.termHeader)

  // 分隔线
  px(g, ox + 1, oy + 4, w - 2, 1, C.termEdge, 0.3)

  // 窗口按钮 — 原型中是圆形点，各 1×1 格
  px(g, ox + 3, oy + 2, 1, 1, C.dotR)
  px(g, ox + 5, oy + 2, 1, 1, C.dotY)
  px(g, ox + 7, oy + 2, 1, 1, C.dotG)

  // >_ 提示符 — 原型中 > 是 3 像素高的箭头，_ 是横杠
  // >  像素布局:
  //   X.
  //   .X
  //   X.
  px(g, ox + 6, oy + 8, 1, 1, C.prompt)
  px(g, ox + 7, oy + 9, 1, 1, C.prompt)
  px(g, ox + 6, oy + 10, 1, 1, C.prompt)
  // _ 光标
  if (cursorVisible) {
    px(g, ox + 9, oy + 10, 2, 1, C.prompt)
  }

  // 右侧小闪光
  px(g, ox + w - 3, oy + 6, 1, 1, C.tSparkle)
  px(g, ox + w - 2, oy + 7, 1, 1, C.tSparkle, 0.45)
}

// ── 发光平台 ──
// 原型：紧凑、明亮的霓虹椭圆环

function drawPlatform(g: Graphics, cx: number, cy: number, glow: number): void {
  const layers: Array<[number, number, number, number]> = [
    [78, 12, C.platGlow, 0.05 * glow],
    [70, 10, C.platBright, 0.12 * glow],
    [62, 8, C.platMid, 0.35 + 0.30 * glow],
    [50, 6, C.platDeep, 0.55 + 0.25 * glow],
    [36, 4, C.platCore, 0.65 + 0.20 * glow],
  ]
  for (const [rx, ry, color, alpha] of layers) {
    g.ellipse(cx, cy + 1, rx, ry)
    g.fill({ color, alpha })
  }
  // 亮环
  g.ellipse(cx, cy, 62, 8)
  g.stroke({ color: C.platBright, width: 2, alpha: 0.5 + 0.4 * glow })
  g.ellipse(cx, cy - 1, 48, 5)
  g.stroke({ color: C.platRim, width: 1.5, alpha: 0.4 + 0.5 * glow })
  // 顶弧高光
  g.ellipse(cx, cy - 2, 32, 3)
  g.stroke({ color: C.platRim, width: 1, alpha: 0.25 + 0.35 * glow })
}

// ── 爱心 ──

function drawHeart(g: Graphics, cx: number, cy: number): void {
  const x = cx / PIX
  const y = cy / PIX
  // 经典 5 行像素心
  px(g, x - 4, y, 3, 2, C.heart)
  px(g, x + 1, y, 3, 2, C.heart)
  px(g, x - 5, y + 2, 10, 2, C.heart)
  px(g, x - 3, y + 4, 6, 2, C.heart)
  px(g, x - 1, y + 6, 2, 2, C.heart)
  px(g, x - 3, y, 1, 1, C.heartHi)
}

// ── 闪光 ──

function drawSparkle(g: Graphics, cx: number, cy: number, color: number, alpha: number): void {
  const s = PIX
  g.rect(cx - s * 2, cy - s / 2, s * 4, s)
  g.fill({ color, alpha })
  g.rect(cx - s / 2, cy - s * 2, s, s * 4)
  g.fill({ color, alpha })
  g.rect(cx - s / 2, cy - s / 2, s, s)
  g.fill({ color, alpha: Math.min(1, alpha * 1.5) })
}

// ── 思考气泡 ──

function drawThoughtBubble(g: Graphics, cx: number, cy: number): void {
  const x = cx / PIX
  const y = cy / PIX
  px(g, x - 8, y - 6, 16, 8, C.bubble)
  px(g, x - 7, y - 5, 14, 6, 0xffffff)
  px(g, x - 2, y + 2, 2, 2, C.bubble)
  px(g, x, y + 4, 1, 1, C.bubble)
}

// ── 布局 ──
// N_ART: ~24 宽 × 26 高（网格坐标）
// 终端: 24 × 16（网格坐标）
// 终端覆盖 N 右半部分

const LAYOUT = {
  mascotY: -4,
  nX: -18,        // N 左边缘
  nY: -18,        // N 顶边缘
  termOx: 13,     // 终端靠在 N 的右下侧
  termOy: 2,      // 终端稍低于 N 顶部
  termRotation: 0.05,
  platformY: 22,
  heartX: 14,
  heartY: -68,
} as const

const SPARKLE_HAPPY: Array<[number, number, number]> = [
  [-26, -54, C.sparkYellow],
  [38, -52, C.sparkPurple],
]

const SPARKLE_EXCITED: Array<[number, number, number]> = [
  [-26, -54, C.sparkYellow],
  [38, -52, C.sparkPurple],
  [-38, -34, C.sparkYellow],
  [48, -30, C.sparkPurple],
]

// ── 引擎 ──

export class WelcomePixelAnimationEngine {
  private app: Application | null = null
  private mascotGroup: Container | null = null
  private platformGfx: Graphics | null = null

  private terminalGfx: Graphics | null = null
  private heartGfx: Graphics | null = null
  private sparkleGfx: Graphics | null = null
  private bubbleGfx: Graphics | null = null
  private bubbleText: Text | null = null

  private stateIndex = 0
  private sequence: StoryboardState[] = [...IDLE_CYCLE]
  private idleLoops = 0
  private stateElapsed = 0
  private currentGlow = 0.55
  private running = false
  private resizeObserver: ResizeObserver | null = null

  constructor(private readonly host: HTMLElement) {}

  async init(): Promise<void> {
    const app = new Application()
    await app.init({
      width: SCENE_W,
      height: SCENE_H,
      backgroundAlpha: 0,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      roundPixels: true,
    })
    app.canvas.style.imageRendering = 'pixelated'
    app.canvas.style.display = 'block'
    this.host.appendChild(app.canvas)

    const root = new Container()
    app.stage.addChild(root)

    const bgGfx = new Graphics()
    bgGfx.rect(0, 0, SCENE_W, SCENE_H)
    bgGfx.fill(C.bg)
    root.addChild(bgGfx)

    const mascotGroup = new Container()
    mascotGroup.x = SCENE_W / 2
    mascotGroup.y = SCENE_H / 2 + 28 + LAYOUT.mascotY
    root.addChild(mascotGroup)
    this.mascotGroup = mascotGroup

    const platformGfx = new Graphics()
    mascotGroup.addChild(platformGfx)
    this.platformGfx = platformGfx

    const nGfx = new Graphics()
    mascotGroup.addChild(nGfx)
    drawLogoN(nGfx, LAYOUT.nX, LAYOUT.nY)

    const terminalGfx = new Graphics()
    terminalGfx.rotation = LAYOUT.termRotation
    mascotGroup.addChild(terminalGfx)
    this.terminalGfx = terminalGfx

    const nFrontGfx = new Graphics()
    mascotGroup.addChild(nFrontGfx)
    drawLogoNForeground(nFrontGfx, LAYOUT.nX, LAYOUT.nY)

    const effectsGroup = new Container()
    mascotGroup.addChild(effectsGroup)

    const heartGfx = new Graphics()
    effectsGroup.addChild(heartGfx)
    this.heartGfx = heartGfx

    const sparkleGfx = new Graphics()
    effectsGroup.addChild(sparkleGfx)
    this.sparkleGfx = sparkleGfx

    const bubbleGfx = new Graphics()
    bubbleGfx.visible = false
    effectsGroup.addChild(bubbleGfx)
    this.bubbleGfx = bubbleGfx

    const bubbleText = new Text({
      text: '?',
      style: {
        fill: C.bubbleText,
        fontFamily: 'monospace',
        fontSize: 16,
        fontWeight: 'bold',
      },
    })
    bubbleText.anchor.set(0.5)
    bubbleText.visible = false
    effectsGroup.addChild(bubbleText)
    this.bubbleText = bubbleText

    this.redrawScene(STATE_FRAMES.idle_1)

    this.app = app
    this.resizeObserver = new ResizeObserver(() => this.syncCanvasLayout())
    this.resizeObserver.observe(this.host)
    this.syncCanvasLayout()

    app.ticker.add(this.onTick)
  }

  start(): void {
    this.running = true
  }

  dispose(): void {
    this.running = false
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    const app = this.app
    if (app) {
      app.ticker.remove(this.onTick)
      app.destroy(true, { children: true })
      app.canvas.remove()
    }
    this.app = null
  }

  private syncCanvasLayout = (): void => {
    const app = this.app
    if (!app) return
    const { clientWidth, clientHeight } = this.host
    if (clientWidth <= 0 || clientHeight <= 0) return
    const scale = Math.min(clientWidth / SCENE_W, clientHeight / SCENE_H)
    const w = Math.floor(SCENE_W * scale)
    const h = Math.floor(SCENE_H * scale)
    app.canvas.style.width = `${w}px`
    app.canvas.style.height = `${h}px`
    app.canvas.style.margin = `${Math.floor((clientHeight - h) / 2)}px auto 0`
  }

  private onTick = (ticker: { deltaMS: number }): void => {
    if (!this.running) return
    this.stateElapsed += ticker.deltaMS
    const state = this.sequence[this.stateIndex] ?? 'idle_1'
    const frame = STATE_FRAMES[state]
    const progress = Math.min(1, this.stateElapsed / frame.durationMs)

    let y = frame.y
    if (state === 'happy') {
      y = lerp(0, frame.y, easeOutBack(progress))
    } else if (state === 'idle_2' || state === 'idle_3') {
      const prev = this.sequence[this.stateIndex - 1] ?? 'idle_1'
      const fromY = STATE_FRAMES[prev]?.y ?? 0
      y = lerp(fromY, frame.y, progress)
    }

    const glow = state.startsWith('idle')
      ? lerp(this.currentGlow, frame.glow, Math.min(1, progress * 2))
      : lerp(this.currentGlow, frame.glow, Math.min(1, progress * 3))

    this.currentGlow = glow
    this.redrawScene({ ...frame, y, glow })

    if (this.stateElapsed >= frame.durationMs) {
      this.advanceState()
    }
  }

  private advanceState(): void {
    this.stateElapsed = 0
    const finished = this.sequence[this.stateIndex]
    if (finished === 'idle_3') {
      this.idleLoops += 1
      if (this.idleLoops >= 2) {
        this.sequence = [...REACT_SEQUENCE]
        this.stateIndex = 0
        this.idleLoops = 0
        return
      }
    }
    if (finished === 'thinking') {
      this.sequence = [...IDLE_CYCLE]
      this.stateIndex = 0
      return
    }
    this.stateIndex = (this.stateIndex + 1) % this.sequence.length
  }

  private redrawScene(frame: {
    y: number
    glow: number
    heart: boolean
    sparkles: number
    bubble: boolean
  }): void {
    const { mascotGroup, platformGfx, terminalGfx, heartGfx, sparkleGfx, bubbleGfx, bubbleText } =
      this
    if (!mascotGroup || !platformGfx || !terminalGfx || !heartGfx || !sparkleGfx || !bubbleGfx || !bubbleText) {
      return
    }

    mascotGroup.y = SCENE_H / 2 + 28 + LAYOUT.mascotY + frame.y

    platformGfx.clear()
    drawPlatform(platformGfx, 0, LAYOUT.platformY, frame.glow)

    const cursorVisible = Math.floor(performance.now() / 480) % 2 === 0
    terminalGfx.clear()
    drawTerminal(terminalGfx, LAYOUT.nX + LAYOUT.termOx, LAYOUT.nY + LAYOUT.termOy, cursorVisible)

    heartGfx.clear()
    if (frame.heart) {
      drawHeart(heartGfx, LAYOUT.heartX, LAYOUT.heartY)
    }

    sparkleGfx.clear()
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 150)
    const sparkleList = frame.sparkles >= 4 ? SPARKLE_EXCITED : SPARKLE_HAPPY
    for (let i = 0; i < frame.sparkles; i++) {
      const [sx, sy, color] = sparkleList[i] ?? [0, -40, C.sparkYellow]
      drawSparkle(sparkleGfx, sx, sy, color, pulse)
    }

    bubbleGfx.clear()
    bubbleGfx.visible = frame.bubble
    bubbleText.visible = frame.bubble
    if (frame.bubble) {
      drawThoughtBubble(bubbleGfx, LAYOUT.heartX + 6, LAYOUT.heartY + 10)
      bubbleText.x = LAYOUT.heartX + 6
      bubbleText.y = LAYOUT.heartY - 2
    }
  }
}
