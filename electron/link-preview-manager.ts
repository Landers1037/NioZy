import { BrowserWindow, WebContentsView } from 'electron'
import { getEmbeddedWebPreferences } from './chromium-tuning'

export interface LinkPreviewBounds {
  x: number
  y: number
  width: number
  height: number
}

interface ManagedView {
  view: WebContentsView
  tabId: string
  url: string
  contentVisible: boolean
  lastEffectivelyVisible: boolean
  hasLoaded: boolean
  pendingLoad: boolean
}

const EMBEDDED_VIEW_BG = '#181818'

export class LinkPreviewManager {
  private readonly views = new Map<string, ManagedView>()
  private overlaySuppressCount = 0

  constructor(
    private getWindow: () => BrowserWindow | null,
    private readonly disableSandbox: boolean,
  ) {}

  private isEffectivelyVisible(entry: ManagedView): boolean {
    return entry.contentVisible && this.overlaySuppressCount === 0
  }

  private applyBounds(entry: ManagedView, bounds: LinkPreviewBounds): void {
    if (bounds.width <= 0 || bounds.height <= 0) return
    entry.view.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }

  private async startLoad(entry: ManagedView): Promise<void> {
    if (entry.hasLoaded || entry.pendingLoad) return
    const bounds = entry.view.getBounds()
    if (bounds.width <= 0 || bounds.height <= 0) return
    if (!this.isEffectivelyVisible(entry)) return

    entry.pendingLoad = true
    try {
      await entry.view.webContents.loadURL(entry.url, {})
      entry.hasLoaded = true
    } catch (err) {
      console.error('[NioZy] link preview load failed:', entry.url, err)
    } finally {
      entry.pendingLoad = false
    }
  }

  private syncViewVisible(entry: ManagedView): void {
    const nowVisible = this.isEffectivelyVisible(entry)
    const wasVisible = entry.lastEffectivelyVisible
    entry.view.setVisible(nowVisible)
    entry.lastEffectivelyVisible = nowVisible

    if (nowVisible) {
      void this.startLoad(entry)
      if (wasVisible === false && entry.hasLoaded) {
        const currentUrl = entry.view.webContents.getURL()
        if (currentUrl && currentUrl !== 'about:blank') {
          entry.view.webContents.reload()
        }
      }
    }
  }

  private syncAllVisible(): void {
    for (const entry of this.views.values()) {
      this.syncViewVisible(entry)
    }
  }

  setOverlaySuppressed(suppressed: boolean): void {
    if (suppressed) {
      this.overlaySuppressCount += 1
    } else {
      this.overlaySuppressCount = Math.max(0, this.overlaySuppressCount - 1)
    }
    this.syncAllVisible()
  }

  open(tabId: string, url: string, initialBounds?: LinkPreviewBounds): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return

    this.close(tabId)

    const view = new WebContentsView({
      webPreferences: getEmbeddedWebPreferences({
        disableSandbox: this.disableSandbox,
      }),
    })
    view.setBackgroundColor(EMBEDDED_VIEW_BG)

    win.contentView.addChildView(view)

    const entry: ManagedView = {
      view,
      tabId,
      url,
      contentVisible: true,
      lastEffectivelyVisible: false,
      hasLoaded: false,
      pendingLoad: false,
    }
    this.views.set(tabId, entry)

    if (initialBounds) {
      this.applyBounds(entry, initialBounds)
    }

    this.syncViewVisible(entry)
    void this.startLoad(entry)
  }

  setBounds(tabId: string, bounds: LinkPreviewBounds): void {
    const entry = this.views.get(tabId)
    if (!entry) return
    this.applyBounds(entry, bounds)
    void this.startLoad(entry)
  }

  setVisible(tabId: string, visible: boolean): void {
    const entry = this.views.get(tabId)
    if (!entry) return
    entry.contentVisible = visible
    this.syncViewVisible(entry)
  }

  close(tabId: string): void {
    const entry = this.views.get(tabId)
    if (!entry) return
    const win = this.getWindow()
    if (win && !win.isDestroyed()) {
      try {
        win.contentView.removeChildView(entry.view)
      } catch {
        /* view may already be detached */
      }
    }
    entry.view.webContents.close()
    this.views.delete(tabId)
  }

  closeAll(): void {
    for (const tabId of [...this.views.keys()]) {
      this.close(tabId)
    }
  }
}
