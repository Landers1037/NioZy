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
import { runMainWorkerTask } from './workers/main-worker-pool'

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
  const skillFiles = (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const id = entry.name
          const skillPath = skillFilePath(id)
          if (!existsSync(skillPath)) return null
          const content = await readFile(skillPath, 'utf-8')
          return { id, content }
        }),
    )
  ).filter((file): file is { id: string; content: string } => file !== null)

  return runMainWorkerTask<AiSkillSummary[]>('ai:assembleSkillSummaries', { skillFiles })
}

export async function buildAiChatContext(ruleStates: AiRuleStates): Promise<AiChatContextPayload> {
  const ruleIds = await listRuleIds()
  const enabledIds = ruleIds.filter((id) => ruleStates[id] === true)

  const [ruleFiles, skillEntries] = await Promise.all([
    Promise.all(
      enabledIds.map(async (id) => {
        const content = await readAiRule(id)
        return { id, content: content ?? '' }
      }),
    ),
    (async () => {
      await ensureAiDirs()
      const entries = await readdir(getAiSkillsDir(), { withFileTypes: true })
      return Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const id = entry.name
            const path = skillFilePath(id)
            if (!existsSync(path)) return null
            const content = await readFile(path, 'utf-8')
            return { id, content }
          }),
      )
    })(),
  ])

  const skillFiles = skillEntries.filter(
    (file): file is { id: string; content: string } => file !== null,
  )

  return runMainWorkerTask<AiChatContextPayload>('ai:assembleChatContext', {
    ruleFiles,
    skillFiles,
    ruleStates,
  })
}

export async function ensureAiSkillsDir(): Promise<string> {
  await ensureAiDirs()
  const dir = getAiSkillsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}
