import type { TerminalColorScheme } from '../../../electron/shared/api-types'
import {
  TERMINAL_THEMES,
  getColorSchemeLabel,
  getThemePalette,
  normalizeTerminalColorScheme,
} from '@/lib/terminal-themes'

interface ColorSchemePreviewProps {
  schemeId: TerminalColorScheme
}

function PaletteSwatches({ colors }: { colors: string[] }) {
  const normal = colors.slice(0, 8)
  const bright = colors.slice(8, 16)

  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <div className="flex gap-1">
        {normal.map((c, i) => (
          <span
            key={`n-${i}`}
            className="size-3.5 shrink-0 rounded-full border border-white/10 shadow-sm"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {bright.map((c, i) => (
          <span
            key={`b-${i}`}
            className="size-3.5 shrink-0 rounded-full border border-white/10 shadow-sm"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  )
}

function TerminalMock({ schemeId }: { schemeId: TerminalColorScheme }) {
  const theme = TERMINAL_THEMES[schemeId]
  const fg = theme.foreground ?? '#c5c8c6'
  const bg = theme.background ?? '#1e1e1e'
  const green = theme.green ?? '#98c379'
  const blue = theme.blue ?? '#61afef'
  const red = theme.red ?? '#e06c75'
  const yellow = theme.yellow ?? '#e5c07b'
  const white = theme.white ?? fg
  const brightBlack = theme.brightBlack ?? '#5c6370'
  const cursor = theme.cursor ?? fg

  const meta = 'text-[11px] leading-relaxed font-mono'
  const perm = brightBlack

  return (
    <div
      className="overflow-hidden rounded-lg px-3 py-2.5"
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className={meta}>
        <span style={{ color: green }}>john</span>
        <span style={{ color: white }}>@</span>
        <span style={{ color: blue }}>doe-pc</span>
        <span style={{ color: red }}>$</span>
        <span> ls</span>
        <span
          className="ml-0.5 inline-block h-[1.1em] w-2 align-[-0.15em]"
          style={{ backgroundColor: cursor }}
        />
      </div>
      <div className={`${meta} mt-1`} style={{ color: perm }}>
        -rwxr-xr-x 1 root <span style={{ color: yellow }}>Documents</span>
      </div>
      <div className={`${meta} mt-0.5`} style={{ color: perm }}>
        -rwxr-xr-x 1 root{' '}
        <span
          className="rounded-sm px-1"
          style={{ color: bg, backgroundColor: green }}
        >
          Downloads
        </span>
      </div>
      <div className={`${meta} mt-0.5`} style={{ color: perm }}>
        -rwxr-xr-x 1 root{' '}
        <span
          className="rounded-sm px-1"
          style={{ color: bg, backgroundColor: brightBlack }}
        >
          Pictures
        </span>
      </div>
      <div className={`${meta} mt-0.5`} style={{ color: perm }}>
        -rwxr-xr-x 1 root <span style={{ color: white }}>Music</span>
      </div>
    </div>
  )
}

export function ColorSchemePreview({ schemeId }: ColorSchemePreviewProps) {
  const id = normalizeTerminalColorScheme(schemeId)
  const theme = TERMINAL_THEMES[id]
  const palette = getThemePalette(theme)
  const label = getColorSchemeLabel(id)
  const panelBg = theme.brightBlack ?? theme.black ?? '#2a2a2a'

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: panelBg }}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <h3
          className="text-lg font-normal tracking-tight"
          style={{ color: theme.foreground ?? '#abb2bf' }}
        >
          {label}
        </h3>
        <PaletteSwatches colors={palette} />
      </div>
      <TerminalMock schemeId={id} />
    </div>
  )
}
