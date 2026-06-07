import { app, type BrowserWindow } from 'electron'
import type { WebPreferences } from 'electron'
import { isElectronDev } from './shared/is-dev'

export interface ChromiumTuningOptions {
  /** 为 true 时启用 Chromium 后台节流（非活动 Tab 休眠） */
  inactiveTabSleep?: boolean
}

/**
 * 在 app.whenReady() 之前调用：关闭终端应用用不到的 Chromium 子系统，减轻开销。
 * 不修改用户「硬件加速」设置；GPU 路径仍由 disableHardwareAcceleration 控制。
 */
export function applyChromiumPerformanceFlags(options: ChromiumTuningOptions = {}): void {
  const inactiveTabSleep = options.inactiveTabSleep === true

  const disabledFeatures = [
    'Translate',
    'TranslateUI',
    'MediaRouter',
    'GlobalMediaControls',
    'WebOTP',
    'InterestFeedContentSuggestions',
    'AutofillServerCommunication',
    'OptimizationHints',
    'PrivacySandboxAdsAPIs',
    'LensOverlay',
    'HardwareMediaKeyHandling',
    'CalculateNativeWinOcclusion',
  ]

  app.commandLine.appendSwitch('disable-features', disabledFeatures.join(','))

  if (!inactiveTabSleep) {
    app.commandLine.appendSwitch('disable-background-timer-throttling')
    app.commandLine.appendSwitch('disable-renderer-backgrounding')
    app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  }
}

/**
 * 在 app.whenReady() 之前调用：按用户设置启用 Chromium WebGPU。
 * 仅在硬件加速开启时生效；调用方应传入 isWebGpuAccelerationEnabled() 的结果。
 */
export function applyWebGpuFlags(enabled: boolean): void {
  if (!enabled) return
  app.commandLine.appendSwitch('enable-unsafe-webgpu')
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'Vulkan')
  }
}

/** 运行时同步 WebContents 后台节流（与「非活动 Tab 休眠」开关联动）。 */
export function syncInactiveTabSleepThrottling(
  window: BrowserWindow | null | undefined,
  inactiveTabSleep: boolean,
): void {
  if (!window || window.isDestroyed()) return
  window.webContents.setBackgroundThrottling(inactiveTabSleep)
}

/** 内嵌 WebContentsView（链接预览）无需 preload */
export function getEmbeddedWebPreferences(options: {
  disableSandbox: boolean
}): WebPreferences {
  return {
    sandbox: !options.disableSandbox,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
    devTools: isElectronDev(),
    spellcheck: false,
    backgroundThrottling: false,
    navigateOnDragDrop: false,
    autoplayPolicy: 'document-user-activation-required',
    enableWebSQL: false,
  }
}

export function getOptimizedWebPreferences(
  preloadPath: string,
  options: { disableSandbox: boolean; inactiveTabSleep?: boolean },
): WebPreferences {
  const inactiveTabSleep = options.inactiveTabSleep === true
  return {
    preload: preloadPath,
    sandbox: !options.disableSandbox,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: true,
    devTools: isElectronDev(),
    spellcheck: false,
    backgroundThrottling: inactiveTabSleep,
    navigateOnDragDrop: false,
    autoplayPolicy: 'document-user-activation-required',
    enableWebSQL: false,
  }
}
