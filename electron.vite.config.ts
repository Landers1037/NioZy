import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

function copyMainAssets(): Plugin {
  const shellSrc = resolve('electron/scripts/shell-integration.ps1')
  const elevBridgeSrc = resolve('electron/scripts/elevated-shell-bridge.ps1')
  const elevWorkerSrc = resolve('electron/scripts/elevated-shell-bridge-worker.ps1')
  const askpassSrc = resolve('electron/scripts/ssh-askpass.mjs')
  const traySrc = resolve('electron/assets/tray.png')
  const mainOut = resolve('out/main')
  const scriptsOut = resolve(mainOut, 'scripts')
  return {
    name: 'copy-main-assets',
    writeBundle() {
      mkdirSync(scriptsOut, { recursive: true })
      const bom = Buffer.from([0xef, 0xbb, 0xbf])
      const writePs1 = (src: string, name: string) => {
        writeFileSync(resolve(scriptsOut, name), Buffer.concat([bom, readFileSync(src)]))
      }
      writePs1(shellSrc, 'shell-integration.ps1')
      writePs1(elevBridgeSrc, 'elevated-shell-bridge.ps1')
      writePs1(elevWorkerSrc, 'elevated-shell-bridge-worker.ps1')
      writeFileSync(resolve(scriptsOut, 'ssh-askpass.mjs'), readFileSync(askpassSrc))
      writeFileSync(resolve(mainOut, 'tray.png'), readFileSync(traySrc))
    },
  }
}
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const FONT_ASSET_PATTERN = /\.(ttf|otf|woff2?)$/i

function fontAssetFileNames(name: string | undefined): string | undefined {
  if (name && FONT_ASSET_PATTERN.test(name)) return 'fonts/[name][extname]'
  return undefined
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: 'esbuild',
      lib: {
        entry: resolve('electron/main/index.ts'),
        formats: ['es'],
      },
      rollupOptions: {
        treeshake: true,
        plugins: [copyMainAssets()],
        output: {
          entryFileNames: '[name].mjs',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: 'esbuild',
      lib: {
        entry: resolve('electron/preload/index.ts'),
        formats: ['es'],
      },
      rollupOptions: {
        treeshake: true,
        output: {
          entryFileNames: '[name].mjs',
        },
      },
    },
  },
  renderer: {
    root: '.',
    server: {
      strictPort: false,
    },
    build: {
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        treeshake: {
          moduleSideEffects: 'no-external',
          preset: 'recommended',
        },
        input: resolve('index.html'),
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('@radix-ui')) return 'radix'
            if (id.includes('@xterm')) return 'xterm'
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
            return 'vendor'
          },
          assetFileNames(assetInfo) {
            return fontAssetFileNames(assetInfo.name) ?? 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
