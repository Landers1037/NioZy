import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root as HastRoot, Element, Properties } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mathToMarkdown } from 'mdast-util-math'

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'className',
      'dataMdSource',
      'dataBlockKind',
      'dataLanguage',
    ],
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'dataMdSource', 'dataBlockKind'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className', 'dataMdSource', 'dataBlockKind'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'details',
    'summary',
    'mark',
    'sub',
    'sup',
    'video',
    'iframe',
  ],
}

function rehypePreserveBlocks() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || index == null) return

      if (node.tagName === 'pre' && node.children.length === 1) {
        const code = node.children[0]
        if (code.type === 'element' && code.tagName === 'code') {
          const className = String(code.properties?.className ?? '')
          const langMatch = className.match(/language-([\w-]+)/)
          const lang = langMatch?.[1] ?? ''
          const text = extractText(code)
          if (lang === 'mermaid') {
            const replacement: Element = {
              type: 'element',
              tagName: 'div',
              properties: {
                className: ['markdown-md-block', 'markdown-mermaid-block'],
                dataBlockKind: 'mermaid',
                dataMdSource: `\`\`\`mermaid\n${text}\n\`\`\``,
              },
              children: [{ type: 'text', value: text }],
            }
            parent.children[index] = replacement
            return
          }
          node.properties = {
            ...node.properties,
            className: ['markdown-md-block'],
            dataBlockKind: 'code',
            dataLanguage: lang,
            dataMdSource: `\`\`\`${lang}\n${text}\n\`\`\``,
          }
        }
      }

      if (
        node.tagName === 'span' &&
        (node.properties?.className as string[] | undefined)?.includes('katex')
      ) {
        const tex = String(node.properties?.dataMdSource ?? '')
        if (!tex) {
          node.properties = {
            ...node.properties,
            dataBlockKind: 'math-inline',
          }
        }
      }

      if (
        node.tagName === 'div' &&
        (node.properties?.className as string[] | undefined)?.includes('katex-display')
      ) {
        node.properties = {
          ...node.properties,
          dataBlockKind: 'math-block',
        }
      }
    })
  }
}

function extractText(node: Element): string {
  let out = ''
  for (const child of node.children) {
    if (child.type === 'text') out += child.value
    else if (child.type === 'element') out += extractText(child)
  }
  return out
}

const remarkProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)

const htmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex)
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypePreserveBlocks)
  .use(rehypeStringify, {
    allowDangerousHtml: true,
    closeSelfClosing: true,
  })

export function parseMarkdownToMdast(markdown: string): MdastRoot {
  return remarkProcessor.parse(markdown) as MdastRoot
}

export function markdownToHtml(markdown: string): string {
  const file = htmlProcessor.processSync(markdown)
  return String(file)
}

export function mdastToMarkdown(tree: MdastRoot): string {
  return toMarkdown(tree, {
    extensions: [gfmToMarkdown(), mathToMarkdown()],
    bullet: '-',
  })
}

export function markdownToPlainHtmlDocument(markdown: string, title: string): string {
  const body = markdownToHtml(markdown)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<style>
body { max-width: 860px; margin: 2rem auto; padding: 0 1.5rem; font-family: system-ui, sans-serif; line-height: 1.75; }
pre { background: #f6f8fa; padding: 1rem; border-radius: 8px; overflow: auto; }
code { font-family: ui-monospace, monospace; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 0.5rem; }
blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1rem; color: #555; }
</style>
</head>
<body>${body}</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function domToMarkdown(root: HTMLElement): string {
  const parts: string[] = []
  for (const child of Array.from(root.childNodes)) {
    parts.push(nodeToMarkdown(child))
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\s+/g, ' ')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const mdSource = el.getAttribute('data-md-source')
  if (mdSource) return mdSource

  const tag = el.tagName.toLowerCase()

  if (tag === 'br') return '\n'

  if (tag === 'h1') return `# ${inlineMarkdown(el)}`
  if (tag === 'h2') return `## ${inlineMarkdown(el)}`
  if (tag === 'h3') return `### ${inlineMarkdown(el)}`
  if (tag === 'h4') return `#### ${inlineMarkdown(el)}`
  if (tag === 'h5') return `##### ${inlineMarkdown(el)}`
  if (tag === 'h6') return `###### ${inlineMarkdown(el)}`
  if (tag === 'p') return inlineMarkdown(el)
  if (tag === 'hr') return '---'
  if (tag === 'blockquote') {
    return Array.from(el.children)
      .map((c) => `> ${nodeToMarkdown(c)}`)
      .join('\n')
  }
  if (tag === 'ul') {
    return Array.from(el.children)
      .map((li) => {
        const checked = (li as HTMLElement).querySelector('input[type=checkbox]') as HTMLInputElement | null
        if (checked) {
          const mark = checked.checked ? '[x]' : '[ ]'
          const text = inlineMarkdown(li as HTMLElement).replace(/^\s*\[[ xX]\]\s*/, '')
          return `- ${mark} ${text}`.trim()
        }
        return `- ${inlineMarkdown(li as HTMLElement)}`
      })
      .join('\n')
  }
  if (tag === 'ol') {
    return Array.from(el.children)
      .map((li, i) => `${i + 1}. ${inlineMarkdown(li as HTMLElement)}`)
      .join('\n')
  }
  if (tag === 'pre') {
    const code = el.querySelector('code')
    const lang = code?.className.match(/language-([\w-]+)/)?.[1] ?? ''
    const text = code?.textContent ?? el.textContent ?? ''
    return `\`\`\`${lang}\n${text}\n\`\`\``
  }
  if (tag === 'table') return tableToMarkdown(el)

  if (el.classList.contains('katex-display')) {
    const ann = el.querySelector('annotation')
    const tex = ann?.textContent?.trim()
    if (tex) return `$$\n${tex}\n$$`
  }

  const children = Array.from(el.childNodes).map(nodeToMarkdown).join('')
  return children
}

function inlineMarkdown(el: HTMLElement): string {
  let out = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const child = node as HTMLElement
    const mdSource = child.getAttribute('data-md-source')
    if (mdSource) {
      out += mdSource
      continue
    }
    const tag = child.tagName.toLowerCase()
    const inner = inlineMarkdown(child)
    if (tag === 'strong' || tag === 'b') out += `**${inner}**`
    else if (tag === 'em' || tag === 'i') out += `*${inner}*`
    else if (tag === 'del' || tag === 's') out += `~~${inner}~~`
    else if (tag === 'code') out += `\`${inner}\``
    else if (tag === 'a') {
      const href = child.getAttribute('href') ?? ''
      out += `[${inner}](${href})`
    } else if (child.classList.contains('katex')) {
      const ann = child.querySelector('annotation')
      const tex = ann?.textContent?.trim()
      out += tex ? `$${tex}$` : inner
    } else if (tag === 'br') out += '\n'
    else if (tag === 'img') {
      const alt = child.getAttribute('alt') ?? ''
      const src = child.getAttribute('src') ?? ''
      out += `![${alt}](${src})`
    } else out += inner
  }
  return out.trim()
}

function tableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return ''
  const lines: string[] = []
  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
      inlineMarkdown(cell as HTMLElement).replace(/\|/g, '\\|'),
    )
    lines.push(`| ${cells.join(' | ')} |`)
    if (rowIndex === 0) {
      lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
    }
  })
  return lines.join('\n')
}

export type { Properties }
