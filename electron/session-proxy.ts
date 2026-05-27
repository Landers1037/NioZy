import { session } from 'electron'

/** 将设置中的代理规则应用到默认 session（影响 WebContentsView / fetch 等） */
export async function applySessionProxy(proxyRules: string): Promise<void> {
  const rules = proxyRules.trim()
  if (!rules) {
    await session.defaultSession.setProxy({ mode: 'direct' })
    return
  }
  await session.defaultSession.setProxy({ proxyRules: rules })
}
