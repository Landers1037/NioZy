export type TerminalCursorStyle = 'block' | 'underline' | 'bar'

export function normalizeTerminalCursorStyle(value: unknown): TerminalCursorStyle {
  if (value === 'underline' || value === 'bar') return value
  return 'block'
}
