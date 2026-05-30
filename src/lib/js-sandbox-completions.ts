export type JsSandboxCompletion = {
  label: string
  insertText: string
  detail?: string
  kind: 'keyword' | 'global' | 'property' | 'history'
}

type CompletionContext = {
  prefix: string
  replaceStart: number
  replaceEnd: number
  memberOf?: string
}

const KEYWORDS: JsSandboxCompletion[] = [
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
].map((label) => ({ label, insertText: label, kind: 'keyword' as const }))

const GLOBALS: JsSandboxCompletion[] = [
  'Array',
  'BigInt',
  'Boolean',
  'Date',
  'Error',
  'EvalError',
  'Function',
  'Infinity',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'RangeError',
  'ReferenceError',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'URIError',
  'WeakMap',
  'WeakSet',
  'console',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'eval',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'unescape',
].map((label) => ({ label, insertText: label, kind: 'global' as const }))

const MEMBER_COMPLETIONS: Record<string, JsSandboxCompletion[]> = {
  console: [
    { label: 'log', insertText: 'log', detail: 'console.log(...)', kind: 'property' },
    { label: 'warn', insertText: 'warn', detail: 'console.warn(...)', kind: 'property' },
    { label: 'error', insertText: 'error', detail: 'console.error(...)', kind: 'property' },
  ],
  Math: [
    'abs',
    'ceil',
    'cos',
    'floor',
    'log',
    'max',
    'min',
    'pow',
    'random',
    'round',
    'sin',
    'sqrt',
    'tan',
    'trunc',
  ].map((label) => ({ label, insertText: label, kind: 'property' as const })),
  Object: ['assign', 'create', 'entries', 'freeze', 'keys', 'values'].map((label) => ({
    label,
    insertText: label,
    kind: 'property' as const,
  })),
  Array: ['from', 'isArray', 'of'].map((label) => ({
    label,
    insertText: label,
    kind: 'property' as const,
  })),
  JSON: [
    { label: 'parse', insertText: 'parse', detail: 'JSON.parse(text)', kind: 'property' },
    { label: 'stringify', insertText: 'stringify', detail: 'JSON.stringify(value)', kind: 'property' },
  ],
  String: ['fromCharCode', 'fromCodePoint', 'raw'].map((label) => ({
    label,
    insertText: label,
    kind: 'property' as const,
  })),
  Number: ['isFinite', 'isInteger', 'isNaN', 'parseFloat', 'parseInt'].map((label) => ({
    label,
    insertText: label,
    kind: 'property' as const,
  })),
  Promise: ['all', 'race', 'reject', 'resolve'].map((label) => ({
    label,
    insertText: label,
    kind: 'property' as const,
  })),
}

function getCompletionContext(text: string, cursor: number): CompletionContext | null {
  const before = text.slice(0, cursor)

  const memberMatch = /([a-zA-Z_$][\w$]*)\.([\w$]*)$/.exec(before)
  if (memberMatch) {
    const memberOf = memberMatch[1]!
    const prefix = memberMatch[2] ?? ''
    const replaceStart = cursor - prefix.length
    return { prefix, replaceStart, replaceEnd: cursor, memberOf }
  }

  const identMatch = /([a-zA-Z_$][\w$]*)$/.exec(before)
  if (!identMatch) return null

  const prefix = identMatch[1]!
  if (!prefix) return null
  const replaceStart = cursor - prefix.length
  return { prefix, replaceStart, replaceEnd: cursor }
}

function filterCompletions(
  items: JsSandboxCompletion[],
  prefix: string,
  limit: number,
): JsSandboxCompletion[] {
  const lower = prefix.toLowerCase()
  const matches = items.filter((item) => item.label.toLowerCase().startsWith(lower))
  matches.sort((a, b) => {
    const aExact = a.label.toLowerCase() === lower
    const bExact = b.label.toLowerCase() === lower
    if (aExact !== bExact) return aExact ? -1 : 1
    if (a.label.length !== b.label.length) return a.label.length - b.label.length
    return a.label.localeCompare(b.label)
  })
  return matches.slice(0, limit)
}

export function getJsSandboxCompletions(
  text: string,
  cursor: number,
  history: string[],
  limit = 10,
): { context: CompletionContext; items: JsSandboxCompletion[] } | null {
  const context = getCompletionContext(text, cursor)
  if (!context) return null

  const { prefix, memberOf } = context

  if (memberOf) {
    const members = MEMBER_COMPLETIONS[memberOf]
    if (!members) return null
    const items = filterCompletions(members, prefix, limit)
    return items.length > 0 ? { context, items } : null
  }

  const keywordItems = filterCompletions(KEYWORDS, prefix, limit)
  const globalItems = filterCompletions(GLOBALS, prefix, limit)
  const historyItems: JsSandboxCompletion[] = []
  const seen = new Set<string>()

  for (const entry of [...history].reverse()) {
    const trimmed = entry.trim()
    if (!trimmed || seen.has(trimmed)) continue
    if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) continue
    seen.add(trimmed)
    historyItems.push({
      label: trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed,
      insertText: trimmed,
      detail: 'history',
      kind: 'history',
    })
    if (historyItems.length >= 3) break
  }

  const merged: JsSandboxCompletion[] = []
  const used = new Set<string>()
  for (const item of [...historyItems, ...globalItems, ...keywordItems]) {
    if (used.has(item.insertText)) continue
    used.add(item.insertText)
    merged.push(item)
    if (merged.length >= limit) break
  }

  return merged.length > 0 ? { context, items: merged } : null
}

export function applyJsSandboxCompletion(
  text: string,
  context: CompletionContext,
  completion: JsSandboxCompletion,
): { text: string; cursor: number } {
  const before = text.slice(0, context.replaceStart)
  const after = text.slice(context.replaceEnd)
  const nextText = before + completion.insertText + after
  return {
    text: nextText,
    cursor: context.replaceStart + completion.insertText.length,
  }
}
