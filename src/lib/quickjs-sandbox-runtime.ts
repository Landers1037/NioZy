import {
  newQuickJSWASMModule,
  newVariant,
  RELEASE_SYNC,
  type QuickJSWASMModule,
} from 'quickjs-emscripten'
import quickjsWasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'

let modulePromise: Promise<QuickJSWASMModule> | null = null

async function fetchWasmBinary(): Promise<ArrayBuffer> {
  const response = await fetch(quickjsWasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load QuickJS WASM (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  const magic = new Uint8Array(buffer, 0, 4)
  if (
    magic[0] !== 0x00 ||
    magic[1] !== 0x61 ||
    magic[2] !== 0x73 ||
    magic[3] !== 0x6d
  ) {
    throw new Error('QuickJS WASM response is not a valid WebAssembly module')
  }
  return buffer
}

/** Load QuickJS with an explicit WASM URL (required in Web Workers). */
export function loadQuickJsSandboxModule(): Promise<QuickJSWASMModule> {
  modulePromise ??= (async () => {
    const wasmBinary = await fetchWasmBinary()
    const variant = newVariant(RELEASE_SYNC, { wasmBinary })
    return newQuickJSWASMModule(variant)
  })()
  return modulePromise
}

export function disposeQuickJsSandboxModule(): void {
  modulePromise = null
}
