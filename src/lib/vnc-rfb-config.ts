import RFB from '@novnc/novnc'
import {
  buildVnc24BitEncodingOrder,
  VNC_ENCODING_NUM,
  type VncEncoding,
} from '../../electron/shared/vnc-settings'

type RfbInstance = InstanceType<typeof RFB>

/** noVNC 默认 17ms 节流鼠标事件；TigerVNC 等场景下会明显感到不跟手 */
const VNC_MOUSE_MOVE_DELAY_MS = 8

type RfbInternal = RfbInstance & {
  _sendEncodings: () => void
  _refreshCursor: () => void
  _handleMouseMove: (x: number, y: number) => void
  _sock: unknown
  _fbDepth: number
  _qualityLevel: number
  _compressionLevel: number
  _mousePos: { x: number; y: number }
  _mouseButtonMask: number
  _mouseMoveTimer: ReturnType<typeof setTimeout> | null
  _mouseLastMoveTime: number
  _sendMouse: (x: number, y: number, mask: number) => void
}

export interface VncRfbExperimentalOptions {
  hardwareAccel: boolean
  localCursor: boolean
  encoding: VncEncoding
}

/** noVNC pseudo / extra encodings（与 encodings.js 一致） */
const NOVNC_ENC = {
  encodingCopyRect: 1,
  encodingH264: 50,
  encodingRaw: 0,
  pseudoEncodingQualityLevel0: -32,
  pseudoEncodingCompressLevel0: -256,
  pseudoEncodingDesktopSize: -223,
  pseudoEncodingLastRect: -224,
  pseudoEncodingQEMUExtendedKeyEvent: -258,
  pseudoEncodingQEMULedEvent: -261,
  pseudoEncodingExtendedDesktopSize: -308,
  pseudoEncodingXvp: -309,
  pseudoEncodingFence: -312,
  pseudoEncodingContinuousUpdates: -313,
  pseudoEncodingExtendedMouseButtons: -316,
  pseudoEncodingDesktopName: -307,
  pseudoEncodingExtendedClipboard: 0xc0a1e5ce,
  pseudoEncodingVMwareCursor: 0x574d5664,
  pseudoEncodingCursor: -239,
} as const

let canvasAccelInstalled = false
let canvasAccelPatchCount = 0

/**
 * noVNC 1.7 使用 Canvas 2D（非 WebGL）。开启硬件加速时，在 noVNC 创建 canvas 之前
 * 注入 GPU 友好的 2D 上下文选项（desynchronized 等），以提升 Chromium 下的绘制性能。
 */
export function installVncCanvasAccelHints(): () => void {
  canvasAccelPatchCount += 1
  if (canvasAccelInstalled) {
    return () => {
      canvasAccelPatchCount -= 1
    }
  }

  const proto = HTMLCanvasElement.prototype
  const original = proto.getContext
  proto.getContext = function patchedGetContext(
    this: HTMLCanvasElement,
    contextId: string,
    options?: CanvasRenderingContext2DSettings,
  ) {
    if (contextId === '2d') {
      const merged: CanvasRenderingContext2DSettings = {
        ...(options ?? {}),
        alpha: false,
        desynchronized: true,
        willReadFrequently: false,
      }
      return original.call(this, contextId, merged)
    }
    return original.call(this, contextId, options)
  }
  canvasAccelInstalled = true

  return () => {
    canvasAccelPatchCount -= 1
    if (canvasAccelPatchCount <= 0 && canvasAccelInstalled) {
      proto.getContext = original
      canvasAccelInstalled = false
      canvasAccelPatchCount = 0
    }
  }
}

function encodingNum(name: VncEncoding): number {
  return VNC_ENCODING_NUM[name]
}

function maySupportH264(): boolean {
  return typeof VideoDecoder !== 'undefined'
}

/**
 * 连接建立后刷新本地光标。noVNC 初始为透明光标（cursor: none），在服务端下发光标形状前
 * 用户可能只能看到 framebuffer 里延迟绘制的远程光标；开启 showDotCursor 可先显示本地指示点。
 */
export function primeVncLocalCursor(rfb: RfbInstance, localCursor: boolean): void {
  if (!localCursor) return
  const internal = rfb as RfbInternal
  try {
    internal._refreshCursor()
  } catch {
    // ignore
  }
}

/** 降低鼠标事件发送间隔（noVNC 内置 17ms），改善远程悬停/拖拽反馈 */
export function patchVncMouseMoveThrottle(rfb: RfbInstance): void {
  const internal = rfb as RfbInternal
  internal._handleMouseMove = function patchedHandleMouseMove(x: number, y: number) {
    internal._mousePos = { x, y }
    if (internal._mouseMoveTimer != null) return

    const elapsed = Date.now() - internal._mouseLastMoveTime
    if (elapsed > VNC_MOUSE_MOVE_DELAY_MS) {
      internal._sendMouse(x, y, internal._mouseButtonMask)
      internal._mouseLastMoveTime = Date.now()
      return
    }

    internal._mouseMoveTimer = setTimeout(() => {
      internal._mouseMoveTimer = null
      internal._sendMouse(internal._mousePos.x, internal._mousePos.y, internal._mouseButtonMask)
      internal._mouseLastMoveTime = Date.now()
    }, VNC_MOUSE_MOVE_DELAY_MS - elapsed)
  }
}

/** TigerVNC 等：略降压缩、提高画质，减少编码延迟 */
export function applyVncLatencyTuning(rfb: RfbInstance): void {
  rfb.compressionLevel = 1
  rfb.qualityLevel = 8
}

/** 覆盖 noVNC 内部 _sendEncodings，以应用首选编码与本地光标设置 */
export function applyVncRfbExperimentalOptions(
  rfb: RfbInstance,
  options: VncRfbExperimentalOptions,
): void {
  const internal = rfb as RfbInternal
  const { localCursor, encoding } = options
  const preferredOrder = buildVnc24BitEncodingOrder(encoding)

  // 服务端未及时下发光标形状时，用本地圆点代替不可见的透明光标
  rfb.showDotCursor = localCursor

  internal._sendEncodings = function patchedSendEncodings() {
    const encs: number[] = []

    encs.push(NOVNC_ENC.encodingCopyRect)

    if (this._fbDepth === 24) {
      if (maySupportH264()) {
        encs.push(NOVNC_ENC.encodingH264)
      }
      for (const name of preferredOrder) {
        encs.push(encodingNum(name))
      }
    }

    if (!encs.includes(NOVNC_ENC.encodingRaw)) {
      encs.push(NOVNC_ENC.encodingRaw)
    }

    encs.push(NOVNC_ENC.pseudoEncodingQualityLevel0 + this._qualityLevel)
    encs.push(NOVNC_ENC.pseudoEncodingCompressLevel0 + this._compressionLevel)

    encs.push(NOVNC_ENC.pseudoEncodingDesktopSize)
    encs.push(NOVNC_ENC.pseudoEncodingLastRect)
    encs.push(NOVNC_ENC.pseudoEncodingQEMUExtendedKeyEvent)
    encs.push(NOVNC_ENC.pseudoEncodingQEMULedEvent)
    encs.push(NOVNC_ENC.pseudoEncodingExtendedDesktopSize)
    encs.push(NOVNC_ENC.pseudoEncodingXvp)
    encs.push(NOVNC_ENC.pseudoEncodingFence)
    encs.push(NOVNC_ENC.pseudoEncodingContinuousUpdates)
    encs.push(NOVNC_ENC.pseudoEncodingDesktopName)
    encs.push(NOVNC_ENC.pseudoEncodingExtendedClipboard)
    encs.push(NOVNC_ENC.pseudoEncodingExtendedMouseButtons)

    if (localCursor && this._fbDepth === 24) {
      encs.push(NOVNC_ENC.pseudoEncodingVMwareCursor)
      encs.push(NOVNC_ENC.pseudoEncodingCursor)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(RFB as any).messages.clientEncodings(this._sock, encs)
  }
}

export function applyVncViewportOptions(
  rfb: RfbInstance,
  adaptiveScale: boolean,
): void {
  rfb.scaleViewport = adaptiveScale
  rfb.clipViewport = !adaptiveScale
  rfb.resizeSession = false
}
