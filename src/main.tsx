import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installBrowserDevMockIfNeeded } from '@/lib/electron-browser-mock'
import App from './App'
import './index.css'

installBrowserDevMockIfNeeded()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
