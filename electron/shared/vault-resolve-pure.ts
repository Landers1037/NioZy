export function resolveTextPure(text: string, variables: Record<string, string>): string {
  return text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    if (name in variables) return variables[name]!
    return `\${${name}}`
  })
}

export function resolveTextsPure(texts: string[], variables: Record<string, string>): string[] {
  return texts.map((text) => resolveTextPure(text, variables))
}
