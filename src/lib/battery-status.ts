export function getBatteryLevelTone(percent: number): 'low' | 'medium' | 'high' {
  if (percent <= 20) return 'low'
  if (percent <= 50) return 'medium'
  return 'high'
}

const batteryToneClasses = {
  light: {
    low: 'border-red-600/45 bg-red-600/12 text-red-700',
    medium: 'border-yellow-600/45 bg-yellow-600/12 text-yellow-800',
    high: 'border-green-600/45 bg-green-600/12 text-green-800',
  },
  dark: {
    low: 'border-red-400/45 bg-red-500/18 text-red-300',
    medium: 'border-yellow-400/45 bg-yellow-500/18 text-yellow-200',
    high: 'border-green-400/45 bg-green-500/18 text-green-300',
  },
} as const

const batteryToneColors = {
  low: '#ef4444',
  medium: '#eab308',
  high: '#22c55e',
} as const

export function getBatteryTagClassName(percent: number, isDark: boolean): string {
  const tone = getBatteryLevelTone(percent)
  return batteryToneClasses[isDark ? 'dark' : 'light'][tone]
}

export function getBatteryIconColor(percent: number): string {
  return batteryToneColors[getBatteryLevelTone(percent)]
}
