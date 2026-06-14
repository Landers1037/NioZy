import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  ensureAiDirs,
  getAiRulesDir,
  getAiSkillsDir,
} from './config-paths'
import type {
  AiChatContextPayload,
  AiRuleStates,
  AiRuleSummary,
  AiSkillSummary,
} from './shared/ai-context-types'
import { sanitizeAiRuleId } from './shared/ai-context-types'

const RULE_FILE_EXT = '.md'
const SKILL_FILE_NAME = 'SKILL.md'

function ruleFilePath(id: string): string {
  return join(getAiRulesDir(), `${id}${RULE_FILE_EXT}`)
}

function skillDirPath(id: string): string {
  return join(getAiSkillsDir(), id)
}

function skillFilePath(id: string): string {
  return join(skillDirPath(id), SKILL_FILE_NAME)
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
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

async function listRuleIds(): Promise<string[]> {
  await ensureAiDirs()
  const entries = await readdir(getAiRulesDir(), { withFileTypes: true })
  const ids: string[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(RULE_FILE_EXT)) continue
    const id = entry.name.slice(0, -RULE_FILE_EXT.length)
    if (sanitizeAiRuleId(id)) ids.push(id)
  }
  return ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export async function listAiRules(ruleStates: AiRuleStates): Promise<AiRuleSummary[]> {
  const ids = await listRuleIds()
  return ids.map((id) => ({
    id,
    enabled: ruleStates[id] === true,
  }))
}

export async function readAiRule(id: string): Promise<string | null> {
  const sanitized = sanitizeAiRuleId(id)
  if (!sanitized) return null
  const path = ruleFilePath(sanitized)
  if (!existsSync(path)) return null
  return readFile(path, 'utf-8')
}

export async function saveAiRule(id: string, content: string): Promise<void> {
  const sanitized = sanitizeAiRuleId(id)
  if (!sanitized) throw new Error('INVALID_RULE_ID')
  await ensureAiDirs()
  await writeFile(ruleFilePath(sanitized), content, 'utf-8')
}

export async function deleteAiRule(id: string): Promise<void> {
  const sanitized = sanitizeAiRuleId(id)
  if (!sanitized) throw new Error('INVALID_RULE_ID')
  const path = ruleFilePath(sanitized)
  if (!existsSync(path)) return
  await rm(path)
}

export async function listAiSkills(): Promise<AiSkillSummary[]> {
  await ensureAiDirs()
  const entries = await readdir(getAiSkillsDir(), { withFileTypes: true })
  const skills: AiSkillSummary[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const id = entry.name
    const skillPath = skillFilePath(id)
    if (!existsSync(skillPath)) continue
    const content = await readFile(skillPath, 'utf-8')
    const meta = parseSkillFrontmatter(content)
    skills.push({
      id,
      name: meta.name || id,
      description: meta.description,
    })
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export async function buildAiChatContext(ruleStates: AiRuleStates): Promise<AiChatContextPayload> {
  const ruleIds = await listRuleIds()
  const rules: AiChatContextPayload['rules'] = []
  for (const id of ruleIds) {
    if (ruleStates[id] !== true) continue
    const content = await readAiRule(id)
    if (content?.trim()) rules.push({ id, content })
  }

  const skillSummaries = await listAiSkills()
  const skills: AiChatContextPayload['skills'] = []
  for (const skill of skillSummaries) {
    const content = await readFile(skillFilePath(skill.id), 'utf-8')
    if (content.trim()) {
      skills.push({ id: skill.id, name: skill.name, content })
    }
  }

  return { rules, skills }
}

export async function ensureAiSkillsDir(): Promise<string> {
  await ensureAiDirs()
  const dir = getAiSkillsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}
