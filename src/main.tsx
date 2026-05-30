import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import '@/lib/i18n'
import { installBrowserDevMockIfNeeded } from '@/lib/electron-browser-mock'
import { bootstrapAppFromPreload } from '@/lib/bootstrap-app'
import App from './App'
import './index.css'
import { ensureWtermTerminalThemes } from '@/lib/wterm-theme'
import { ScreenshotApp } from '@/screens/screenshot/ScreenshotApp'

ensureWtermTerminalThemes()

installBrowserDevMockIfNeeded()
bootstrapAppFromPreload()

const isScreenshotWindow = window.location.hash.startsWith('#/screenshot')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isScreenshotWindow ? <ScreenshotApp /> : <App />}
    <Toaster position="bottom-right" richColors closeButton />
  </StrictMode>,
)
