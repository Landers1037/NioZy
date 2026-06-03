import Screenshots, { type Lang } from 'electron-screenshots'
import type { AppLocale } from './shared/locale'
import { mainLog } from './app-log'

const SCREENSHOT_LANG: Record<AppLocale, Lang> = {
  zh: {
    magnifier_position_label: '坐标',
    operation_ok_title: '完成',
    operation_cancel_title: '取消',
    operation_save_title: '保存',
    operation_redo_title: '重做',
    operation_undo_title: '撤销',
    operation_mosaic_title: '马赛克',
    operation_text_title: '文字',
    operation_brush_title: '画笔',
    operation_arrow_title: '箭头',
    operation_ellipse_title: '椭圆',
    operation_rectangle_title: '矩形',
  },
  en: {
    magnifier_position_label: 'Position',
    operation_ok_title: 'Done',
    operation_cancel_title: 'Cancel',
    operation_save_title: 'Save',
    operation_redo_title: 'Redo',
    operation_undo_title: 'Undo',
    operation_mosaic_title: 'Mosaic',
    operation_text_title: 'Text',
    operation_brush_title: 'Brush',
    operation_arrow_title: 'Arrow',
    operation_ellipse_title: 'Ellipse',
    operation_rectangle_title: 'Rectangle',
  },
  ja: {
    magnifier_position_label: '座標',
    operation_ok_title: '完了',
    operation_cancel_title: 'キャンセル',
    operation_save_title: '保存',
    operation_redo_title: 'やり直し',
    operation_undo_title: '元に戻す',
    operation_mosaic_title: 'モザイク',
    operation_text_title: 'テキスト',
    operation_brush_title: 'ブラシ',
    operation_arrow_title: '矢印',
    operation_ellipse_title: '楕円',
    operation_rectangle_title: '矩形',
  },
}

let instance: Screenshots | null = null

export function initScreenshotsService(locale: AppLocale): Screenshots {
  if (instance) return instance

  instance = new Screenshots({
    lang: SCREENSHOT_LANG[locale],
    singleWindow: true,
  })

  instance.on('windowCreated', () => {
    mainLog.debug('[screenshots] window created')
  })
  instance.on('windowClosed', () => {
    mainLog.debug('[screenshots] window closed')
  })

  return instance
}

export function getScreenshotsService(): Screenshots | null {
  return instance
}

export async function syncScreenshotsLang(locale: AppLocale): Promise<void> {
  await instance?.setLang(SCREENSHOT_LANG[locale])
}

export async function openScreenshotCapture(): Promise<void> {
  if (!instance) {
    throw new Error('SCREENSHOTS_NOT_INITIALIZED')
  }
  await instance.startCapture()
}

export async function closeScreenshotCapture(): Promise<void> {
  await instance?.endCapture()
}

export async function disposeScreenshotsService(): Promise<void> {
  if (!instance) return
  try {
    await instance.endCapture()
  } catch {
    // ignore
  }
  if (instance.$win && !instance.$win.isDestroyed()) {
    instance.$win.destroy()
  }
  instance = null
}
