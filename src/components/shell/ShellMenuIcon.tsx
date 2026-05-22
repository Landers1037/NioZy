import { SquareTerminal, Terminal } from 'lucide-react'
import type { BuiltinShellType } from '../../../electron/shared/builtin-shells'
import { BUILTIN_SHELL_ICON_COLORS } from '@/lib/shell-appearance'
import { cn } from '@/lib/utils'

interface ShellMenuIconProps {
  shell: BuiltinShellType
  className?: string
}

export function ShellMenuIcon({ shell, className }: ShellMenuIconProps) {
  const color = BUILTIN_SHELL_ICON_COLORS[shell]
  const iconClass = cn('size-4 shrink-0', className)

  if (shell === 'cmd') {
    return (
      <SquareTerminal className={iconClass} style={{ color }} strokeWidth={2} aria-hidden />
    )
  }

  return <Terminal className={iconClass} style={{ color }} strokeWidth={2} aria-hidden />
}
