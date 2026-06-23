export type StatusBarPollPriority = 'high' | 'medium' | 'low'

export const STATUS_BAR_POLL_INTERVAL_MS: Record<StatusBarPollPriority, number> = {
  high: 2000,
  medium: 5000,
  low: 10_000,
}

export const DEFAULT_STATUS_BAR_POLL_PRIORITY: StatusBarPollPriority = 'high'

export function normalizeStatusBarPollPriority(value: unknown): StatusBarPollPriority {
  if (value === 'medium' || value === 'low') return value
  return DEFAULT_STATUS_BAR_POLL_PRIORITY
}

export function statusBarPollIntervalMs(priority: StatusBarPollPriority): number {
  return STATUS_BAR_POLL_INTERVAL_MS[priority]
}
