import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { loadSystemFonts } from '@/lib/system-fonts'
import { cn } from '@/lib/utils'

interface FontFamilyPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FontFamilyPicker({ value, onChange, className }: FontFamilyPickerProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [fonts, setFonts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSystemFonts()
      .then((list) => {
        if (!cancelled) setFonts(list)
      })
      .catch(() => {
        if (!cancelled) setError(t('settings.fontPicker.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setSearch('')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q ? fonts.filter((f) => f.toLowerCase().includes(q)) : fonts
    if (value && !base.includes(value)) {
      return [value, ...base]
    }
    return base
  }, [fonts, search, value])

  const displayLabel = value || t('settings.fontPicker.selectFont')

  return (
    <div ref={rootRef} className={cn('relative max-w-xs', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={loading && fonts.length === 0}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
          'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate font-mono" style={{ fontFamily: value || undefined }}>
          {loading && fonts.length === 0
            ? t('settings.fontPicker.loadingFonts')
            : displayLabel}
        </span>
        {loading && fonts.length === 0 ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 flex w-full flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={t('settings.fontPicker.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {error && (
              <li className="px-3 py-2 text-sm text-muted-foreground">{error}</li>
            )}
            {!error && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t('settings.fontPicker.noMatch')}
              </li>
            )}
            {filtered.map((font) => (
              <li key={font} role="option" aria-selected={font === value}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                    font === value && 'bg-accent font-medium',
                  )}
                  style={{ fontFamily: font }}
                  onClick={() => {
                    onChange(font)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <span className="truncate">{font}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
