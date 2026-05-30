/**
 * REPL 求值包装：纯表达式需包在括号中，QuickJS 才会返回 completion value。
 * 语句形式（console.log、let、块级代码等）保持原样。
 */
export function wrapJsSandboxEvalCode(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return trimmed

  const looksLikeStatement =
    /[;\n{}]/.test(trimmed) ||
    /^(?:let|const|var|function|class|if|for|while|do|switch|try|catch|finally|return|throw|debugger|import|export|async|await)\b/u.test(
      trimmed,
    )

  if (looksLikeStatement) return trimmed
  return `(${trimmed})`
}
