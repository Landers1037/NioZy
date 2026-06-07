import Screenshots, { type Lang } from 'electron-screenshots'
import type { BrowserWindow } from 'electron'
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

type ScreenshotsHostContext = {
  getMainWindow: () => BrowserWindow | null
  shouldHideSelf: () => boolean
}

let instance: Screenshots | null = null
let hostContext: ScreenshotsHostContext | null = null
let savedMainOpacity: number | null = null
let didHideMainForCapture = false

export function configureScreenshotsService(ctx: ScreenshotsHostContext): void {
  hostContext = ctx
}

function hideMainWindowForCapture(): void {
  const win = hostContext?.getMainWindow()
  if (!win || win.isDestroyed() || !hostContext?.shouldHideSelf()) return

  savedMainOpacity = win.getOpacity()
  win.setOpacity(0)
  didHideMainForCapture = true
  mainLog.debug('[screenshots] main window hidden for capture')
}

function restoreMainWindowAfterCapture(): void {
  if (!didHideMainForCapture) return

  const win = hostContext?.getMainWindow()
  if (!win || win.isDestroyed()) {
    didHideMainForCapture = false
    savedMainOpacity = null
    return
  }

  if (savedMainOpacity !== null) {
    win.setOpacity(savedMainOpacity)
  }
  if (!win.isVisible()) {
    win.show()
  }
  didHideMainForCapture = false
  savedMainOpacity = null
  mainLog.debug('[screenshots] main window restored after capture')
}

function bindScreenshotLifecycle(instanceRef: Screenshots): void {
  const restore = () => restoreMainWindowAfterCapture()
  instanceRef.on('ok', restore)
  instanceRef.on('cancel', restore)
  instanceRef.on('windowClosed', restore)
}

export function initScreenshotsService(locale: AppLocale): Screenshots {
  if (instance) return instance

  instance = new Screenshots({
    lang: SCREENSHOT_LANG[locale],
    singleWindow: true,
  })

  bindScreenshotLifecycle(instance)

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

  hideMainWindowForCapture()
  if (didHideMainForCapture) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  try {
    await instance.startCapture()
  } catch (err) {
    restoreMainWindowAfterCapture()
    throw err
  }
}

export async function closeScreenshotCapture(): Promise<void> {
  await instance?.endCapture()
  restoreMainWindowAfterCapture()
}

export async function disposeScreenshotsService(): Promise<void> {
  if (!instance) return
  try {
    await instance.endCapture()
  } catch {
    // ignore
  }
  restoreMainWindowAfterCapture()
  if (instance.$win && !instance.$win.isDestroyed()) {
    instance.$win.destroy()
  }
  instance = null
}
