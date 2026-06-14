import { useEffect, useMemo, useState } from 'react'
import { useAgentContext } from '@copilotkit/react-core/v2'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { useAiContextStore } from '@/stores/ai-context-store'
import type { AiChatContextPayload } from '../../../electron/shared/ai-context-types'

function formatRulesContext(rules: AiChatContextPayload['rules']): string {
  if (rules.length === 0) return ''
  return rules
    .map((rule) => `## Rule: ${rule.id}\n\n${rule.content.trim()}`)
    .join('\n\n---\n\n')
}

function formatSkillsContext(skills: AiChatContextPayload['skills']): string {
  if (skills.length === 0) return ''
  return skills
    .map((skill) => `## Skill: ${skill.name} (${skill.id})\n\n${skill.content.trim()}`)
    .join('\n\n---\n\n')
}

/** 将启用的规则与已导入技能注入 CopilotKit 对话上下文。 */
export function AiCopilotContextBridge() {
  const aiRuleStates = useAppStore((s) => s.settings?.experimental.aiRuleStates)
  const contextRevision = useAiContextStore((s) => s.revision)
  const ruleStatesKey = useMemo(() => JSON.stringify(aiRuleStates ?? {}), [aiRuleStates])
  const [context, setContext] = useState<AiChatContextPayload>({ rules: [], skills: [] })

  useEffect(() => {
    let cancelled = false
    void getElectronAPI()
      .aiContext.getChatContext()
      .then((payload) => {
        if (!cancelled) setContext(payload)
      })
      .catch(() => {
        if (!cancelled) setContext({ rules: [], skills: [] })
      })
    return () => {
      cancelled = true
    }
  }, [ruleStatesKey, contextRevision])

  const rulesValue = useMemo(() => formatRulesContext(context.rules), [context.rules])
  const skillsValue = useMemo(() => formatSkillsContext(context.skills), [context.skills])

  useAgentContext({
    description: 'User-defined rules for this assistant. Follow when relevant.',
    value: rulesValue,
  })

  useAgentContext({
    description: 'User-imported skills (SKILL.md). Use when the task matches a skill.',
    value: skillsValue,
  })

  return null
}
