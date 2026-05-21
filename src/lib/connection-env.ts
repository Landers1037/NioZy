export function parseEnvLines(envStr: string): Record<string, string> {
  const env: Record<string, string> = {}
  envStr.split('\n').forEach((line) => {
    const [k, ...rest] = line.split('=')
    if (k?.trim()) env[k.trim()] = rest.join('=').trim()
  })
  return env
}

export function formatEnvLines(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}
