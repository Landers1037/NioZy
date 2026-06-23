import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const assetsDir = join('out/renderer/assets')
const vendorFile = readdirSync(assetsDir)
  .filter((f) => f.startsWith('vendor-') && f.endsWith('.js'))
  .sort()
  .at(-1)
if (!vendorFile) {
  console.error('vendor chunk not found')
  process.exit(1)
}

const content = readFileSync(join(assetsDir, vendorFile), 'utf8')
const needles = [
  '@js-preview/docx',
  '@js-preview/excel',
  'mammoth',
  'xlsx',
  '@novnc',
  'motion',
  'preact',
  'zustand',
  'sonner',
  'lucide-react',
  'katex',
  'mermaid',
  'pdfjs',
  'highlight.js',
  'node-fetch',
  'sql.js',
  'tailwind-merge',
  'class-variance-authority',
  'clsx',
  'i18next',
  'quickjs',
  'drawio',
  'react-drawio',
  '@ai-sdk',
  '@ag-ui',
  'langchain',
  'openai',
  'anthropic',
  'graphql',
  'rxjs',
  'lodash',
  'dayjs',
  'date-fns',
  'protobuf',
  'unified',
  'remark',
  'rehype',
  'micromark',
  'mdast',
  'hast',
  'streamdown',
  'shiki',
]

for (const needle of needles) {
  let count = 0
  let idx = content.indexOf(needle)
  while (idx !== -1) {
    count++
    idx = content.indexOf(needle, idx + needle.length)
  }
  if (count > 0) console.log(String(count).padStart(6), needle)
}

console.log('\nvendor file:', vendorFile, `(${(content.length / 1024 / 1024).toFixed(2)} MB)`)
