/** Vite renderer manualChunks：避免所有 node_modules 落入单一 vendor 包 */
export function rendererManualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return

  const nm = id.replace(/\\/g, '/')

  if (nm.includes('@radix-ui')) return 'radix'
  if (nm.includes('@xterm')) return 'xterm'
  if (nm.includes('ghostty-web')) return 'ghostty-web'
  if (nm.includes('@wterm')) return 'wterm'
  if (nm.includes('quickjs-emscripten')) return 'quickjs'
  if (nm.includes('@copilotkit')) return 'copilotkit'
  if (
    nm.includes('@shikijs') ||
    nm.includes('/shiki/') ||
    nm.includes('streamdown') ||
    nm.includes('@ag-ui') ||
    nm.includes('/@ai-sdk/')
  ) {
    return 'copilotkit'
  }
  if (nm.includes('i18next') || nm.includes('react-i18next')) return 'i18n'

  if (nm.includes('@excalidraw')) return 'excalidraw'
  if (
    nm.includes('@codemirror') ||
    nm.includes('@uiw/') ||
    nm.includes('/@lezer/') ||
    nm.includes('/@marijn/')
  ) {
    return 'codemirror'
  }

  if (
    nm.includes('/unified/') ||
    nm.includes('/remark-') ||
    nm.includes('/rehype-') ||
    nm.includes('/mdast-') ||
    nm.includes('/hast-') ||
    nm.includes('/micromark') ||
    nm.includes('/unist-')
  ) {
    return 'markdown'
  }

  if (nm.includes('/mermaid/') || nm.includes('@mermaid-js')) return 'mermaid'

  if (nm.includes('react-drawio') || nm.includes('/drawio/')) return 'drawio'

  if (nm.includes('@js-preview')) return 'js-preview'
  if (nm.includes('/mammoth/')) return 'mammoth'
  if (nm.includes('/xlsx/')) return 'xlsx'

  if (nm.includes('@novnc')) return 'novnc'
  if (nm.includes('/three/')) return 'three'

  if (
    nm.includes('/motion/') ||
    nm.includes('motion/react') ||
    nm.includes('framer-motion')
  ) {
    return 'motion'
  }
  // preact / zustand 与 vendor 互引时单独拆包会触发 circular chunk，保留在 vendor
  if (nm.includes('/sonner/')) return 'sonner'
  if (nm.includes('/lucide-react/')) return 'lucide'
  if (nm.includes('/katex/')) return 'katex'

  return 'vendor'
}
