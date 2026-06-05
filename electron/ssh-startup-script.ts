const INITIAL_DELAY_MS = 600
const LINE_DELAY_MS = 120

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 将多行脚本拆成按顺序执行的命令行（忽略仅含空白的行） */
export function parseSshStartupScriptLines(script: string): string[] {
  return script
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
}

/** SSH 交互式 Shell 就绪后，按行依次写入远程终端 */
export function scheduleSshStartupScript(
  write: (data: string) => void,
  script: string,
): void {
  const lines = parseSshStartupScriptLines(script)
  if (lines.length === 0) return

  void (async () => {
    await sleep(INITIAL_DELAY_MS)
    for (const line of lines) {
      write(`${line}\n`)
      await sleep(LINE_DELAY_MS)
    }
  })()
}
