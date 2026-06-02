import RFB from '@novnc/novnc'
import {
  buildVnc24BitEncodingOrder,
  VNC_ENCODING_NUM,
  type VncEncoding,
} from '../../electron/shared/vnc-settings'

type RfbInstance = InstanceType<typeof RFB>

type RfbInternal = RfbInstance & {
  _sendEncodings: () => void
  _sock: unknown
  _fbDepth: number
  _qualityLevel: number
  _compressionLevel: number
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

/** 覆盖 noVNC 内部 _sendEncodings，以应用首选编码与本地光标设置 */
export function applyVncRfbExperimentalOptions(
  rfb: RfbInstance,
  options: VncRfbExperimentalOptions,
): void {
  const internal = rfb as RfbInternal
  const { localCursor, encoding } = options
  const preferredOrder = buildVnc24BitEncodingOrder(encoding)

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
