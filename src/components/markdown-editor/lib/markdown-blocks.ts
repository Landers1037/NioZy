interface BlockSegment {
  kind: 'html' | 'code' | 'mermaid' | 'math'
  content: string
  language?: string
}

type BlockMatch = {
  index: number
  length: number
  kind: BlockSegment['kind']
  content: string
  language?: string
}

function scanSpecialBlock(markdown: string, from: number): BlockMatch | null {
  const slice = markdown.slice(from)
  const candidates: BlockMatch[] = []

  const fenceRe = /^```(\w+)?[^\n]*\n([\s\S]*?)```/
  const fence = fenceRe.exec(slice)
  if (fence) {
    const lang = (fence[1] ?? '').toLowerCase()
    candidates.push({
      index: from,
      length: fence[0].length,
      kind: lang === 'mermaid' ? 'mermaid' : 'code',
      content: fence[0],
      language: lang === 'mermaid' ? undefined : lang,
    })
  }

  const mathRe = /^\$\$([\s\S]+?)\$\$/
  const math = mathRe.exec(slice)
  if (math) {
    candidates.push({
      index: from,
      length: math[0].length,
      kind: 'math',
      content: math[0],
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.index - b.index || a.length - b.length)
  return candidates[0]
}

function splitMarkdownBlocks(markdown: string): BlockSegment[] {
  const segments: BlockSegment[] = []
  let cursor = 0

  while (cursor < markdown.length) {
    const slice = markdown.slice(cursor)
    const fenceAt = slice.indexOf('```')
    const mathAt = slice.indexOf('$$')

    let nextAt = -1
    if (fenceAt >= 0 && mathAt >= 0) nextAt = Math.min(fenceAt, mathAt)
    else if (fenceAt >= 0) nextAt = fenceAt
    else if (mathAt >= 0) nextAt = mathAt

    if (nextAt < 0) {
      const tail = markdown.slice(cursor)
      if (tail.trim() || segments.length === 0) {
        segments.push({ kind: 'html', content: tail })
      }
      break
    }

    if (nextAt > 0) {
      const before = markdown.slice(cursor, cursor + nextAt)
      if (before.trim()) segments.push({ kind: 'html', content: before })
      cursor += nextAt
    }

    const block = scanSpecialBlock(markdown, cursor)
    if (!block) {
      segments.push({ kind: 'html', content: markdown.slice(cursor) })
      break
    }

    segments.push({
      kind: block.kind,
      content: block.content,
      language: block.language,
    })
    cursor = block.index + block.length
  }

  if (segments.length === 0) {
    segments.push({ kind: 'html', content: markdown })
  }

  return segments
}

export type { BlockSegment }
export { splitMarkdownBlocks }
