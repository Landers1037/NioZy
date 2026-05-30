/**
 * REPL 求值包装：纯表达式会写入内部结果槽，worker 再显式读取该结果。
 * 不依赖 QuickJS completion value，避免表达式结果被当作 undefined 丢掉。
 */
export const JS_SANDBOX_RESULT_GLOBAL = '__niozySandboxReplResult'

const STATEMENT_KEYWORD =
  /^(?:let|const|var|function|class|if|for|while|do|switch|try|catch|finally|return|throw|debugger|import|export|async|await)\b/u

function isCommentOnlyLine(line: string): boolean {
  const t = line.trim()
  return t === '' || t.startsWith('//') || t.startsWith('/*')
}

function isExpressionLike(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/[;{}]/.test(trimmed)) return false
  if (STATEMENT_KEYWORD.test(trimmed)) return false
  return true
}

export function shouldCaptureJsSandboxEvalResult(code: string): boolean {
  const trimmed = code.trim()
  if (!trimmed) return false

  const lines = trimmed.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!isCommentOnlyLine(line)) {
      return isExpressionLike(line)
    }
  }
  return false
}

export function wrapJsSandboxEvalCode(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return trimmed

  const lines = trimmed.split('\n')
  let lastContentLineIndex = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isCommentOnlyLine(lines[i]!)) {
      lastContentLineIndex = i
      break
    }
  }
  if (lastContentLineIndex < 0) return trimmed

  const lastLine = lines[lastContentLineIndex]!.trim()
  if (!isExpressionLike(lastLine)) return trimmed

  const prefix = lines.slice(0, lastContentLineIndex).join('\n')
  if (!prefix) {
    return `globalThis.${JS_SANDBOX_RESULT_GLOBAL} = undefined;\nglobalThis.${JS_SANDBOX_RESULT_GLOBAL} = (${lastLine})`
  }

  return `globalThis.${JS_SANDBOX_RESULT_GLOBAL} = undefined;\n(function(){\n${prefix}\nglobalThis.${JS_SANDBOX_RESULT_GLOBAL} = (${lastLine});\n})()`
}
