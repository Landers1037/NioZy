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

  private syncViewVisible(entry: ManagedView): void {
    const nowVisible = this.isEffectivelyVisible(entry)
    entry.view.setVisible(nowVisible)
    entry.lastEffectivelyVisible = nowVisible
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
    // Use transparent background so a load failure shows the app bg
    // rather than an opaque black rectangle.
    view.setBackgroundColor('#00000000')

    // ① Add to window FIRST – on Windows the view needs a valid HWND
    //    parent before setBounds / setVisible take effect.
    win.contentView.addChildView(view)

    // ② Set bounds AFTER addChildView (Windows DWM requirement).
    if (initialBounds && initialBounds.width > 0 && initialBounds.height > 0) {
      view.setBounds({
        x: Math.round(initialBounds.x),
        y: Math.round(initialBounds.y),
        width: Math.round(initialBounds.width),
        height: Math.round(initialBounds.height),
      })
    }

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

    // ③ Make visible.
    this.syncViewVisible(entry)

    // Debug listeners – output visible in `npm run start` terminal.
    view.webContents.on('did-finish-load', () => {
      entry.hasLoaded = true
      console.log(`[NioZy] link preview loaded: ${url}`)
    })

    view.webContents.on('did-fail-load', (_event, code, desc, validatedURL) => {
      console.error(`[NioZy] link preview did-fail-load: ${validatedURL} code=${code} ${desc}`)
    })

    view.webContents.on('render-process-gone', (_event, details) => {
      console.error(
        `[NioZy] link preview renderer gone: reason=${details.reason} exit=${details.exitCode}`,
      )
    })

    // ④ Start loading after the view is wired up.
    entry.pendingLoad = true
    console.log(`[NioZy] link preview opening: ${url}`)
    view.webContents
      .loadURL(url)
      .catch((err) => {
        console.error('[NioZy] link preview loadURL error:', url, err)
      })
      .finally(() => {
        entry.pendingLoad = false
      })
  }

  setBounds(tabId: string, bounds: LinkPreviewBounds): void {
    const entry = this.views.get(tabId)
    if (!entry) return
    this.applyBounds(entry, bounds)
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
