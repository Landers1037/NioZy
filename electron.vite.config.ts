import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

function copyShellIntegrationScript(): Plugin {
  const src = resolve('electron/scripts/shell-integration.ps1')
  const destDir = resolve('out/main/scripts')
  const dest = resolve(destDir, 'shell-integration.ps1')
  return {
    name: 'copy-shell-integration-script',
    writeBundle() {
      mkdirSync(destDir, { recursive: true })
      const content = readFileSync(src)
      writeFileSync(dest, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), content]))
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
        plugins: [copyShellIntegrationScript()],
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
