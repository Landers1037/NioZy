import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface FontSizeInputProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

function clampFontSize(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function FontSizeInput({ label, value, min, max, onChange }: FontSizeInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={1}
          className="max-w-[88px]"
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(n)) onChange(clampFontSize(n, min, max))
          }}
          onBlur={(e) => {
            const n = Number.parseInt(e.target.value, 10)
            onChange(clampFontSize(Number.isNaN(n) ? value : n, min, max))
          }}
        />
        <span className="text-sm text-muted-foreground">px</span>
      </div>
    </div>
  )
}
