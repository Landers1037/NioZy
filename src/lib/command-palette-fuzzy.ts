/** 子序列模糊匹配；返回分数，越高越靠前；无匹配返回 null */
export function fuzzyMatchScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 0
  if (t.includes(q)) return 1000 + (100 - t.indexOf(q))

  let qi = 0
  let score = 0
  let consecutive = 0
  let lastMatch = -1

  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue
    if (lastMatch === i - 1) consecutive += 1
    else consecutive = 0
    score += 1 + consecutive * 2
    if (i === 0 || /[\s\-_/]/.test(t[i - 1]!)) score += 4
    lastMatch = i
    qi += 1
  }

  if (qi < q.length) return null
  return score
}

export function bestFuzzyScore(query: string, texts: string[]): number | null {
  let best: number | null = null
  for (const text of texts) {
    const score = fuzzyMatchScore(query, text)
    if (score == null) continue
    if (best == null || score > best) best = score
  }
  return best
}

/** 将 camelCase 命令 id 拆成可搜索词，如 terminalScreenshot → terminal screenshot */
export function commandIdSearchTerms(id: string): string[] {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return [id.toLowerCase(), spaced]
}
