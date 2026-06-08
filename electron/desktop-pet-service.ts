import { BrowserWindow, Menu, screen } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import { isMainWindowInForeground, toggleMainWindowForeground } from './global-shortcuts'
import type { SettingsStore } from './settings-store'
import type { ReminderDuePayload } from './shared/reminder-data'
import type { DesktopPetPosition } from './shared/reminder-settings'
import { PET_DISPLAY_HEIGHT, PET_DISPLAY_WIDTH } from './shared/pet-atlas'
import { getPetUiLabels } from './shared/pet-ui-labels'
import {
  PET_WINDOW_COMPACT,
  PET_WINDOW_WITH_BOTH,
  PET_WINDOW_WITH_DUE_ALERT,
  PET_WINDOW_WITH_REMINDER_LIST,
} from './shared/pet-window-layout'
import { mainLog } from './app-log'
import { isElectronDev } from './shared/is-dev'

type DesktopPetHostContext = {
  getMainWindow: () => BrowserWindow | null
  settingsStore: SettingsStore
  requestNewTerminal: () => void
}

let hostContext: DesktopPetHostContext | null = null
let petWindow: BrowserWindow | null = null
let mainWindowTopSyncHandler: (() => void) | null = null
let dragPollTimer: ReturnType<typeof setInterval> | null = null
let petInteraction: {
  startCursorX: number
  startCursorY: number
  offsetX: number
  offsetY: number
  dragging: boolean
} | null = null

const PET_ALWAYS_ON_TOP_LEVEL = 'pop-up-menu' as const
const PET_CLICK_MOVE_THRESHOLD_PX = 6
const PET_DRAG_POLL_MS = 16

type PetMenuLabels = {
  hidePet: string
  show: string
  hide: string
  newTerminal: string
  viewReminders: string
}

function getPetMenuLabels(): PetMenuLabels {
  const locale = hostContext?.settingsStore.get().locale ?? 'zh'
  const ui = getPetUiLabels(locale)
  const toggle =
    locale === 'en'
      ? { show: 'Show NioZy', hide: 'Hide NioZy' }
      : locale === 'ja'
        ? { show: 'NioZy を表示', hide: 'NioZy を非表示' }
        : { show: '显示 NioZy', hide: '隐藏 NioZy' }
  const hidePet =
    locale === 'en'
      ? 'Disable desktop pet'
      : locale === 'ja'
        ? 'デスクトップペットをオフ'
        : '关闭桌面宠物'
  return {
    ...toggle,
    hidePet,
    newTerminal: ui.newTerminal,
    viewReminders: ui.viewReminders,
  }
}

function resizePetWindow(size: { width: number; height: number }): void {
  if (!petWindow || petWindow.isDestroyed()) return
  const bounds = petWindow.getBounds()
  const bottom = bounds.y + bounds.height
  const right = bounds.x + bounds.width
  const nextX = right - size.width
  const nextY = bottom - size.height
  const next = clampPetWindowBounds(nextX, nextY, size.width, size.height)
  petWindow.setBounds({
    x: next.x,
    y: next.y,
    width: size.width,
    height: size.height,
  })
  ensurePetWindowOnTop()
}

export function setPetWindowCompact(): void {
  resizePetWindow(PET_WINDOW_COMPACT)
}

export function setPetWindowReminderList(): void {
  resizePetWindow(PET_WINDOW_WITH_REMINDER_LIST)
}

export function setPetWindowDueAlert(): void {
  resizePetWindow(PET_WINDOW_WITH_DUE_ALERT)
}

export function setPetWindowReminderAndDue(): void {
  resizePetWindow(PET_WINDOW_WITH_BOTH)
}

export function openPetReminders(): void {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.webContents.send('pet:openReminders')
}

export function notifyPetReminderDue(payload: ReminderDuePayload): void {
  if (!hostContext) return
  const settings = hostContext.settingsStore.get().reminder
  if (!settings.enabled || !settings.desktopPetEnabled) return
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.webContents.send('pet:reminderDue', payload)
}

function stopDragPolling(): void {
  if (dragPollTimer) {
    clearInterval(dragPollTimer)
    dragPollTimer = null
  }
}

/** 宠物精灵左下角在屏幕上的坐标（紧凑模式下等于窗口左上角） */
function getPetScreenOrigin(bounds: { x: number; y: number; width: number; height: number }): DesktopPetPosition {
  return {
    x: bounds.x + bounds.width - PET_DISPLAY_WIDTH,
    y: bounds.y + bounds.height - PET_DISPLAY_HEIGHT,
  }
}

/** 已知宠物精灵位置，反推当前尺寸下窗口左上角 */
function windowPositionFromPetOrigin(
  petX: number,
  petY: number,
  width: number,
  height: number,
): DesktopPetPosition {
  return {
    x: Math.round(petX - width + PET_DISPLAY_WIDTH),
    y: Math.round(petY - height + PET_DISPLAY_HEIGHT),
  }
}

/** 拖拽过程中仅跟随光标，不做边界钳位 */
function followCursorWhileDragging(): void {
  if (!petInteraction || !petWindow || petWindow.isDestroyed()) return
  const cursor = screen.getCursorScreenPoint()
  const bounds = petWindow.getBounds()
  const petX = cursor.x - petInteraction.offsetX
  const petY = cursor.y - petInteraction.offsetY
  const win = windowPositionFromPetOrigin(petX, petY, bounds.width, bounds.height)
  petWindow.setPosition(win.x, win.y)
}

function pollPetDrag(): void {
  if (!petInteraction || !petWindow || petWindow.isDestroyed()) {
    stopDragPolling()
    return
  }
  const cursor = screen.getCursorScreenPoint()
  const dx = cursor.x - petInteraction.startCursorX
  const dy = cursor.y - petInteraction.startCursorY
  if (!petInteraction.dragging) {
    if (Math.hypot(dx, dy) < PET_CLICK_MOVE_THRESHOLD_PX) return
    petInteraction.dragging = true
  }
  followCursorWhileDragging()
}

/** 松开时按宠物精灵位置钳位到工作区内，并持久化 */
function finalizeDragPosition(): void {
  if (!petInteraction || !petWindow || petWindow.isDestroyed()) return
  const cursor = screen.getCursorScreenPoint()
  const bounds = petWindow.getBounds()
  const petX = cursor.x - petInteraction.offsetX
  const petY = cursor.y - petInteraction.offsetY
  const clampedPet = clampPetPosition(petX, petY)
  const win = windowPositionFromPetOrigin(
    clampedPet.x,
    clampedPet.y,
    bounds.width,
    bounds.height,
  )
  petWindow.setPosition(win.x, win.y)
  saveDesktopPetPosition(clampedPet.x, clampedPet.y)
  ensurePetWindowOnTop()
}

function startDragPolling(): void {
  stopDragPolling()
  dragPollTimer = setInterval(pollPetDrag, PET_DRAG_POLL_MS)
}

export function onPetReady(): void {
  mainLog.info('[desktop-pet] renderer ready')
}

export function onPetPointerDown(): void {
  if (!petWindow || petWindow.isDestroyed()) return
  const cursor = screen.getCursorScreenPoint()
  const bounds = petWindow.getBounds()
  const pet = getPetScreenOrigin(bounds)
  petInteraction = {
    startCursorX: cursor.x,
    startCursorY: cursor.y,
    offsetX: cursor.x - pet.x,
    offsetY: cursor.y - pet.y,
    dragging: false,
  }
  startDragPolling()
}

export function onPetPointerMove(): void {
  // 拖拽由主进程轮询 screen.getCursorScreenPoint() 驱动，避免渲染层 pointermove 反馈环
}

export function onPetPointerUp(): void {
  if (petInteraction?.dragging) {
    finalizeDragPosition()
  }
  stopDragPolling()
  petInteraction = null
}

export function onPetToggleMain(): void {
  mainLog.info('[desktop-pet] toggleMain (double-click or menu)')
  toggleMainWindowFromPet()
}

export function onPetShowMenu(): void {
  mainLog.info('[desktop-pet] showMenu (context menu)')
  if (!petWindow || petWindow.isDestroyed()) return
  popupPetContextMenu(petWindow)
}

function popupPetContextMenu(win: BrowserWindow): void {
  const ctx = hostContext
  if (!ctx) return
  const labels = getPetMenuLabels()
  const mainWin = ctx.getMainWindow()
  const inForeground = mainWin && !mainWin.isDestroyed() && isMainWindowInForeground(mainWin)
  const toggleLabel = inForeground ? labels.hide : labels.show

  const menu = Menu.buildFromTemplate([
    {
      label: toggleLabel,
      click: () => toggleMainWindowFromPet(),
    },
    {
      label: labels.newTerminal,
      click: () => ctx.requestNewTerminal(),
    },
    {
      label: labels.viewReminders,
      click: () => openPetReminders(),
    },
    { type: 'separator' },
    {
      label: labels.hidePet,
      click: () => {
        ctx.settingsStore.update({
          reminder: {
            ...ctx.settingsStore.get().reminder,
            desktopPetEnabled: false,
          },
        })
        syncDesktopPet()
      },
    },
  ])
  menu.popup({ window: win })
}

function ensurePetWindowOnTop(): void {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.setAlwaysOnTop(true, PET_ALWAYS_ON_TOP_LEVEL)
  petWindow.moveTop()
}

function bindMainWindowTopSync(): void {
  unbindMainWindowTopSync()
  const mainWin = hostContext?.getMainWindow()
  if (!mainWin || mainWin.isDestroyed()) return
  mainWindowTopSyncHandler = () => ensurePetWindowOnTop()
  mainWin.on('focus', mainWindowTopSyncHandler)
  mainWin.on('show', mainWindowTopSyncHandler)
}

function unbindMainWindowTopSync(): void {
  const mainWin = hostContext?.getMainWindow()
  if (mainWin && !mainWin.isDestroyed() && mainWindowTopSyncHandler) {
    mainWin.removeListener('focus', mainWindowTopSyncHandler)
    mainWin.removeListener('show', mainWindowTopSyncHandler)
  }
  mainWindowTopSyncHandler = null
}

function resolvePetPreloadPath(): string {
  const candidates = [
    fileURLToPath(new URL('../preload/pet-preload.mjs', import.meta.url)),
    join(process.cwd(), 'out/preload/pet-preload.mjs'),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return candidates[0]
}

function getDefaultPetPosition(): DesktopPetPosition {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workArea
  const margin = 24
  return {
    x: display.workArea.x + width - PET_DISPLAY_WIDTH - margin,
    y: display.workArea.y + height - PET_DISPLAY_HEIGHT - margin,
  }
}

function clampPetWindowBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): DesktopPetPosition {
  const display = screen.getDisplayNearestPoint({ x: x + width / 2, y: y + height / 2 })
  const area = display.workArea
  const maxX = area.x + area.width - width
  const maxY = area.y + area.height - height
  return {
    x: Math.min(Math.max(Math.round(x), area.x), maxX),
    y: Math.min(Math.max(Math.round(y), area.y), maxY),
  }
}

function clampPetPosition(x: number, y: number): DesktopPetPosition {
  return clampPetWindowBounds(x, y, PET_DISPLAY_WIDTH, PET_DISPLAY_HEIGHT)
}

function resolveInitialPetPosition(): DesktopPetPosition {
  const saved = hostContext?.settingsStore.get().reminder.desktopPetPosition
  if (saved) return clampPetPosition(saved.x, saved.y)
  return getDefaultPetPosition()
}

function loadPetWindowContent(win: BrowserWindow): void {
  if (isElectronDev() && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/src/pet/index.html`)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/src/pet/index.html'))
}

function createPetWindow(): BrowserWindow {
  const pos = resolveInitialPetPosition()
  const preloadPath = resolvePetPreloadPath()
  mainLog.info('[desktop-pet] createPetWindow', {
    pos,
    preloadPath,
    preloadExists: existsSync(preloadPath),
  })

  const win = new BrowserWindow({
    width: PET_DISPLAY_WIDTH,
    height: PET_DISPLAY_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    ...(process.platform === 'win32' ? { type: 'toolbar' as const } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isElectronDev(),
      backgroundThrottling: false,
    },
  })

  win.setAlwaysOnTop(true, PET_ALWAYS_ON_TOP_LEVEL)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.webContents.on('context-menu', (event) => {
    event.preventDefault()
    mainLog.info('[desktop-pet] context-menu (main)')
    popupPetContextMenu(win)
  })

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.setBackgroundColor('#00000000')
    win.showInactive()
    ensurePetWindowOnTop()
    mainLog.info('[desktop-pet] ready-to-show', { bounds: win.getBounds() })
  })

  win.on('blur', () => ensurePetWindowOnTop())

  win.webContents.on('did-finish-load', () => {
    mainLog.info('[desktop-pet] did-finish-load')
  })

  win.webContents.on('preload-error', (_event, path, error) => {
    mainLog.error('[desktop-pet] preload-error', { path, error: String(error) })
  })

  loadPetWindowContent(win)

  win.on('closed', () => {
    if (petWindow === win) petWindow = null
  })

  return win
}

function showPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    if (!petWindow.isVisible()) petWindow.showInactive()
    ensurePetWindowOnTop()
    bindMainWindowTopSync()
    return
  }
  petWindow = createPetWindow()
  bindMainWindowTopSync()
  mainLog.info('[desktop-pet] window created')
}

function hidePetWindow(): void {
  unbindMainWindowTopSync()
  stopDragPolling()
  petInteraction = null
  if (!petWindow || petWindow.isDestroyed()) {
    petWindow = null
    return
  }
  petWindow.close()
  petWindow = null
  mainLog.info('[desktop-pet] window closed')
}

export function configureDesktopPetService(ctx: DesktopPetHostContext): void {
  hostContext = ctx
}

export function reloadPetWindowSprite(): void {
  if (!petWindow || petWindow.isDestroyed()) return
  mainLog.info('[desktop-pet] reload sprite')
  void petWindow.webContents.reload()
}

export function syncDesktopPet(): void {
  if (!hostContext) return
  const enabled = hostContext.settingsStore.get().reminder.desktopPetEnabled === true
  mainLog.info('[desktop-pet] syncDesktopPet', { enabled })
  if (enabled) {
    const hadWindow = Boolean(petWindow && !petWindow.isDestroyed())
    showPetWindow()
    if (hadWindow) reloadPetWindowSprite()
  } else {
    hidePetWindow()
  }
}

export function disposeDesktopPet(): void {
  hidePetWindow()
  hostContext = null
}

/** 将当前窗口位置换算为紧凑模式下宠物精灵的屏幕坐标并持久化 */
function persistDesktopPetPosition(): void {
  if (!hostContext || !petWindow || petWindow.isDestroyed()) return
  const bounds = petWindow.getBounds()
  const petX = bounds.x + bounds.width - PET_DISPLAY_WIDTH
  const petY = bounds.y + bounds.height - PET_DISPLAY_HEIGHT
  const next = clampPetPosition(petX, petY)
  const reminder = hostContext.settingsStore.get().reminder
  hostContext.settingsStore.update({
    reminder: {
      ...reminder,
      desktopPetPosition: next,
    },
  })
}

export function saveDesktopPetPosition(x: number, y: number): void {
  if (!hostContext) return
  const next = clampPetPosition(x, y)
  const reminder = hostContext.settingsStore.get().reminder
  hostContext.settingsStore.update({
    reminder: {
      ...reminder,
      desktopPetPosition: next,
    },
  })
}

function toggleMainWindowFromPet(): void {
  if (!hostContext) return
  toggleMainWindowForeground(hostContext.getMainWindow, hostContext.settingsStore, 'pet')
  ensurePetWindowOnTop()
}
