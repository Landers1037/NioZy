import type { AiChatContextPayload, AiRuleStates, AiSkillSummary } from './ai-context-types'

export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const block = match[1]
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  const description = block
    .match(/^description:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
  return { name, description }
}

export interface AiContextFileInput {
  id: string
  content: string
}

export function assembleSkillSummaries(skillFiles: AiContextFileInput[]): AiSkillSummary[] {
  return skillFiles
    .map((file) => {
      const meta = parseSkillFrontmatter(file.content)
      return {
        id: file.id,
        name: meta.name || file.id,
        description: meta.description,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export function assembleChatContext(
  ruleFiles: AiContextFileInput[],
  skillFiles: AiContextFileInput[],
  ruleStates: AiRuleStates,
): AiChatContextPayload {
  const rules: AiChatContextPayload['rules'] = []
  for (const file of ruleFiles) {
    if (ruleStates[file.id] !== true) continue
    if (file.content.trim()) rules.push({ id: file.id, content: file.content })
  }

  const skills: AiChatContextPayload['skills'] = []
  for (const file of skillFiles) {
    if (!file.content.trim()) continue
    const meta = parseSkillFrontmatter(file.content)
    skills.push({
      id: file.id,
      name: meta.name || file.id,
      content: file.content,
    })
  }

  return { rules, skills }
}
