/**
 * 分析 app.asar 内各文件体积，输出按大小排序的 Top 列表
 * 用法：node scripts/analyze-asar.mjs [asar路径] [--top=50] [--ext=js,css]
 *
 * 示例：
 *   node scripts/analyze-asar.mjs
 *   node scripts/analyze-asar.mjs release/win-unpacked/resources/app.asar --top=100
 *   node scripts/analyze-asar.mjs release/win-unpacked/resources/app.asar --ext=js
 */

import { createRequire } from 'module'
import { existsSync } from 'fs'
import { extname } from 'path'

const require = createRequire(import.meta.url)

// ---------- 参数解析 ----------
const args = process.argv.slice(2)
let asarPath = null
let topN = 50
let filterExt = null

for (const arg of args) {
  if (arg.startsWith('--top=')) topN = parseInt(arg.slice(6), 10)
  else if (arg.startsWith('--ext=')) filterExt = arg.slice(6).split(',').map(e => (e.startsWith('.') ? e : '.' + e))
  else asarPath = arg
}

// 自动寻找 asar 文件
if (!asarPath) {
  const candidates = [
    'release/win-unpacked/resources/app.asar',
    'release/mac/NioZy.app/Contents/Resources/app.asar',
    'release/linux-unpacked/resources/app.asar',
  ]
  for (const c of candidates) {
    if (existsSync(c)) { asarPath = c; break }
  }
}

if (!asarPath || !existsSync(asarPath)) {
  console.error('❌ 找不到 app.asar，请先执行 npm run dist:dir 再运行此脚本')
  console.error('   或手动指定路径：node scripts/analyze-asar.mjs <path/to/app.asar>')
  process.exit(1)
}

// ---------- 读取 asar header ----------
let asar
try {
  asar = require('@electron/asar')
} catch {
  try {
    asar = require('asar')
  } catch {
    console.error('❌ 缺少依赖，请执行：npm install --save-dev @electron/asar')
    process.exit(1)
  }
}

console.log(`\n📦 分析：${asarPath}\n`)

const files = []

function walk(tree, prefix = '') {
  for (const [name, entry] of Object.entries(tree)) {
    const fullPath = prefix ? `${prefix}/${name}` : name
    if (entry.files) {
      walk(entry.files, fullPath)
    } else if (entry.size !== undefined) {
      files.push({ path: fullPath, size: entry.size })
    }
  }
}

const { header } = asar.getRawHeader(asarPath)
walk(header.files)

// ---------- 过滤 ----------
const filtered = filterExt
  ? files.filter(f => filterExt.includes(extname(f.path).toLowerCase()))
  : files

// ---------- 按大小排序 ----------
filtered.sort((a, b) => b.size - a.size)

const fmt = (n) => {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

// ---------- 汇总按目录 ----------
const dirMap = new Map()
for (const f of files) {
  const parts = f.path.split('/')
  const dir = parts.length > 1 ? parts[0] : '(root)'
  dirMap.set(dir, (dirMap.get(dir) ?? 0) + f.size)
}
const dirList = [...dirMap.entries()].sort((a, b) => b[1] - a[1])

const totalSize = files.reduce((s, f) => s + f.size, 0)

console.log('═══════════════════════════════════════════════════════')
console.log(`  总文件数：${files.length}  |  asar 内容总大小：${fmt(totalSize)}`)
console.log('═══════════════════════════════════════════════════════')

console.log('\n📁 按顶层目录汇总：')
for (const [dir, size] of dirList) {
  const pct = ((size / totalSize) * 100).toFixed(1)
  const bar = '█'.repeat(Math.round(pct / 2))
  console.log(`  ${dir.padEnd(30)} ${fmt(size).padStart(10)}  ${pct.padStart(5)}%  ${bar}`)
}

console.log(`\n📄 最大的 Top ${topN} 文件${filterExt ? ` (仅 ${filterExt.join('/')})` : ''}：`)
console.log('─'.repeat(80))
for (const f of filtered.slice(0, topN)) {
  console.log(`  ${fmt(f.size).padStart(10)}   ${f.path}`)
}
console.log('─'.repeat(80))
console.log(`\n✅ 完成。如需只看 JS 文件：node scripts/analyze-asar.mjs --ext=js\n`)
