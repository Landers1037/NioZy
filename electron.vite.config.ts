import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

function copyMainAssets(): Plugin {
  const shellSrc = resolve('electron/scripts/shell-integration.ps1')
  const traySrc = resolve('electron/assets/tray.png')
  const mainOut = resolve('out/main')
  const scriptsOut = resolve(mainOut, 'scripts')
  return {
    name: 'copy-main-assets',
    writeBundle() {
      mkdirSync(scriptsOut, { recursive: true })
      const ps1 = readFileSync(shellSrc)
      writeFileSync(
        resolve(scriptsOut, 'shell-integration.ps1'),
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), ps1]),
      )
      writeFileSync(resolve(mainOut, 'tray.png'), readFileSync(traySrc))
    },
  }
}
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main/index.ts'),
        formats: ['es'],
      },
      rollupOptions: {
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
      lib: {
        entry: resolve('electron/preload/index.ts'),
        formats: ['es'],
      },
      rollupOptions: {
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
      rollupOptions: {
        input: resolve('index.html'),
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
