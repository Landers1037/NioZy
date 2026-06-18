import type { ComponentType } from 'react'
import { Sparkles } from 'lucide-react'
import type { WorkspaceToolId } from '../../../electron/shared/workspace-types'
import {
  ClaudeCodeIcon,
  OpenCodeIcon,
  PiAgentIcon,
} from '@/components/icons/session-tool-icons'
import { cn } from '@/lib/utils'

function CursorAgentIcon({ className }: { className?: string }) {
  return <Sparkles className={cn('size-3.5 shrink-0 text-primary', className)} aria-hidden />
}

export const WORKSPACE_TOOL_ICONS = {
  claude: ClaudeCodeIcon,
  opencode: OpenCodeIcon,
  pi: PiAgentIcon,
  agent: CursorAgentIcon,
} satisfies Record<WorkspaceToolId, ComponentType<{ className?: string }>>

export function WorkspaceToolIcon({
  tool,
  className,
}: {
  tool: WorkspaceToolId
  className?: string
}) {
  const Icon = WORKSPACE_TOOL_ICONS[tool]
  return <Icon className={className} />
}
