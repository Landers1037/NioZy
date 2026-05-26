import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/lib/i18n'
import { installBrowserDevMockIfNeeded } from '@/lib/electron-browser-mock'
import { bootstrapAppFromPreload } from '@/lib/bootstrap-app'
import App from './App'
import './index.css'
import { ensureWtermTerminalThemes } from '@/lib/wterm-theme'

ensureWtermTerminalThemes()

installBrowserDevMockIfNeeded()
bootstrapAppFromPreload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
