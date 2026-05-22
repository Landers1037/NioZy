import { app } from 'electron'
import type { WebPreferences } from 'electron'

/**
 * 在 app.whenReady() 之前调用：关闭终端应用用不到的 Chromium 子系统，减轻开销。
 * 不修改用户「硬件加速」设置；GPU 路径仍由 disableHardwareAcceleration 控制。
 */
export function applyChromiumPerformanceFlags(): void {
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
  ]

  app.commandLine.appendSwitch('disable-features', disabledFeatures.join(','))
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
}

export function getOptimizedWebPreferences(
  preloadPath: string,
  options: { disableSandbox: boolean },
): WebPreferences {
  return {
    preload: preloadPath,
    sandbox: !options.disableSandbox,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
    spellcheck: false,
    backgroundThrottling: false,
    navigateOnDragDrop: false,
    autoplayPolicy: 'document-user-activation-required',
    enableWebSQL: false,
  }
}
