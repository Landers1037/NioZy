import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

function copyMainAssets(): Plugin {
  const shellSrc = resolve('electron/scripts/shell-integration.ps1')
  const ompBootstrapSrc = resolve('electron/scripts/omp-bootstrap.ps1')
  const elevBridgeSrc = resolve('electron/scripts/elevated-shell-bridge.ps1')
  const elevWorkerSrc = resolve('electron/scripts/elevated-shell-bridge-worker.ps1')
  const askpassCmdSrc = resolve('electron/scripts/ssh-askpass.cmd')
  const askpassShSrc = resolve('electron/scripts/ssh-askpass.sh')
  const niozyBinSrc = resolve('electron/scripts/bin')
  const traySrc = resolve('electron/assets/tray.png')
  const mainOut = resolve('out/main')
  const scriptsOut = resolve(mainOut, 'scripts')
  const binOut = resolve(scriptsOut, 'bin')
  return {
    name: 'copy-main-assets',
    writeBundle() {
      mkdirSync(scriptsOut, { recursive: true })
      const bom = Buffer.from([0xef, 0xbb, 0xbf])
      const writePs1 = (src: string, name: string) => {
        writeFileSync(resolve(scriptsOut, name), Buffer.concat([bom, readFileSync(src)]))
      }
      writePs1(shellSrc, 'shell-integration.ps1')
      writePs1(ompBootstrapSrc, 'omp-bootstrap.ps1')
      writePs1(elevBridgeSrc, 'elevated-shell-bridge.ps1')
      writePs1(elevWorkerSrc, 'elevated-shell-bridge-worker.ps1')
      writeFileSync(resolve(scriptsOut, 'ssh-askpass.cmd'), readFileSync(askpassCmdSrc))
      writeFileSync(resolve(scriptsOut, 'ssh-askpass.sh'), readFileSync(askpassShSrc))
      mkdirSync(binOut, { recursive: true })
      for (const name of ['niozy-cat.mjs', 'niozy-cat.cmd', 'niozy-cat']) {
        const src = resolve(niozyBinSrc, name)
        writeFileSync(resolve(binOut, name), readFileSync(src))
      }
      writeFileSync(resolve(mainOut, 'tray.png'), readFileSync(traySrc))
    },
  }
}
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { fontWoff2Plugin } from './scripts/vite-plugin-font-woff2'
import { rendererManualChunks } from './scripts/renderer-manual-chunks'

/** 打进 out/main/copilot-runtime.mjs，避免 asar 内整包 node_modules/@copilotkit/runtime */
const MAIN_BUNDLE_DEPS = [
  '@copilotkit/runtime',
  '@ai-sdk/anthropic',
  '@ai-sdk/openai',
] as const

const FONT_ASSET_PATTERN = /\.(ttf|otf|woff2?)$/i

function fontAssetFileNames(name: string | undefined): string | undefined {
  if (name && FONT_ASSET_PATTERN.test(name)) return 'fonts/[name][extname]'
  return undefined
}

export default defineConfig(({ command }) => {
  const electronDev = command === 'serve'

  return {
  main: {
    define: {
      __ELECTRON_DEV__: JSON.stringify(electronDev),
    },
    plugins: [externalizeDepsPlugin({ exclude: [...MAIN_BUNDLE_DEPS] })],
    build: {
      minify: 'esbuild',
      lib: {
        entry: {
          index: resolve('electron/main/index.ts'),
          'workers/main-worker': resolve('electron/workers/main-worker.ts'),
          'workers/system-stats-worker': resolve('electron/workers/system-stats-worker.ts'),
        },
        formats: ['es'],
      },
      rollupOptions: {
        treeshake: true,
        plugins: [copyMainAssets()],
        output: {
          entryFileNames: '[name].mjs',
          chunkFileNames: 'copilot-[hash].mjs',
          inlineDynamicImports: false,
        },
      },
    },
  },
  preload: {
    define: {
      __ELECTRON_DEV__: JSON.stringify(electronDev),
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: 'esbuild',
      lib: {
        entry: {
          index: resolve('electron/preload/index.ts'),
          'pet-preload': resolve('electron/preload/pet-preload.ts'),
        },
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
    publicDir: resolve('public'),
    server: {
      strictPort: false,
      watch: {
        ignored: ['**/docs/**'],
      },
    },
    // Electron 42+ / Chromium 现代内核；启用 top-level await（noVNC 需要）
    css: {
      lightningcss: {
        // 与 Chromium 渲染目标对齐；避免 Lightning CSS 将 backdrop-filter 降级为仅 -webkit- 前缀
        targets: { chrome: 120 << 16, edge: 120 << 16 },
      },
    },
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    worker: {
      format: 'es',
    },
    build: {
      target: 'es2022',
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        treeshake: {
          moduleSideEffects: 'no-external',
          preset: 'recommended',
        },
        input: {
          main: resolve('index.html'),
          pet: resolve('src/pet/index.html'),
        },
        output: {
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/')
            if (normalized.includes('/src/pet/')) return 'pet'
            return rendererManualChunks(id)
          },
          assetFileNames(assetInfo) {
            if (assetInfo.name?.endsWith('.wasm')) return 'assets/[name][extname]'
            return fontAssetFileNames(assetInfo.name) ?? 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        'react-dom/client': 'preact/compat/client',
      },
    },
    plugins: [preact(), tailwindcss(), ...(electronDev ? [] : [fontWoff2Plugin()])],
  },
}
})
