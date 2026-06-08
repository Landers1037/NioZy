import { PET_ATLAS } from '../../../electron/shared/pet-atlas'

const PREVIEW_FRAME_SCALE = 0.35

type PetSpritePreviewProps = {
  spriteUrl: string
  /** 精灵图行号（动画状态） */
  row?: number
  className?: string
  maxHeight?: number
}

/** 精灵图指定行首帧预览 */
export function PetSpritePreview({
  spriteUrl,
  row = 0,
  className,
  maxHeight = 120,
}: PetSpritePreviewProps) {
  const frameW = Math.round(PET_ATLAS.cellWidth * PREVIEW_FRAME_SCALE)
  const frameH = Math.round(PET_ATLAS.cellHeight * PREVIEW_FRAME_SCALE)
  const sheetW = Math.round(PET_ATLAS.width * PREVIEW_FRAME_SCALE)
  const sheetH = Math.round(PET_ATLAS.height * PREVIEW_FRAME_SCALE)
  const posY = row * PET_ATLAS.cellHeight * PREVIEW_FRAME_SCALE

  return (
    <div
      className={className}
      style={{
        width: frameW,
        height: frameH,
        maxHeight,
        backgroundImage: `url(${spriteUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `0 -${posY}px`,
        backgroundSize: `${sheetW}px ${sheetH}px`,
        imageRendering: 'pixelated',
      }}
      aria-hidden
    />
  )
}
