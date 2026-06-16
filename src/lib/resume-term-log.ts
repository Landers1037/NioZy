import { devDebug, devError, devInfo, devWarn } from '../../electron/shared/dev-log'

const PREFIX = '[NioZy][ResumeTerm]'

export const resumeTermLog = {
  debug: (...args: unknown[]) => devDebug(PREFIX, ...args),
  info: (...args: unknown[]) => devInfo(PREFIX, ...args),
  warn: (...args: unknown[]) => devWarn(PREFIX, ...args),
  error: (...args: unknown[]) => devError(PREFIX, ...args),
}
