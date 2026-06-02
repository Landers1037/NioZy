/** VNC 画面编码（与 noVNC encodings.js 一致，不含 H.264 / Zlib） */
export const VNC_ENCODING_VALUES = [
  'raw',
  'copyrect',
  'rre',
  'hextile',
  'tight',
  'tightPNG',
  'zrle',
  'jpeg',
] as const

export type VncEncoding = (typeof VNC_ENCODING_VALUES)[number]

export const DEFAULT_VNC_ENCODING: VncEncoding = 'tight'

/** noVNC encoding 编号 */
export const VNC_ENCODING_NUM: Record<VncEncoding, number> = {
  raw: 0,
  copyrect: 1,
  rre: 2,
  hextile: 5,
  tight: 7,
  tightPNG: -260,
  zrle: 16,
  jpeg: 21,
}

const FALLBACK_24BIT: VncEncoding[] = [
  'tight',
  'tightPNG',
  'zrle',
  'jpeg',
  'hextile',
  'rre',
]

export function normalizeVncEncoding(value: unknown): VncEncoding {
  if (typeof value === 'string' && (VNC_ENCODING_VALUES as readonly string[]).includes(value)) {
    return value as VncEncoding
  }
  return DEFAULT_VNC_ENCODING
}

/** 构建 24-bit 深度下的编码优先级（不含 copyrect；raw 由调用方置于末尾） */
export function buildVnc24BitEncodingOrder(preferred: VncEncoding): VncEncoding[] {
  if (preferred === 'copyrect') {
    return [...FALLBACK_24BIT]
  }
  const rest = FALLBACK_24BIT.filter((enc) => enc !== preferred)
  if (preferred === 'raw') {
    return ['raw', ...rest]
  }
  return [preferred, ...rest]
}
